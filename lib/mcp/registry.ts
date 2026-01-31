import { google as googleModel } from "@ai-sdk/google";
import { generateObject } from "ai";
import fs from "fs";
import { GoogleAuth, OAuth2Client } from "google-auth-library";
import { google as googleApis, chromepolicy_v1 } from "googleapis";
import path from "path";
import { z } from "zod";

import type { VectorSearchResult } from "@/lib/upstash/search";

import { searchDocs, searchPolicies } from "@/lib/upstash/search";
import { recordActivity } from "../activity-log";

// --- Types & Schemas ---

/**
 * Schema for fetching Chrome audit events.
 * Used by the 'getChromeEvents' tool.
 */
export const GetChromeEventsSchema = z.object({
  maxResults: z
    .number()
    .optional()
    .describe("Number of events to fetch (default 10)"),
});

/**
 * Schema for listing DLP rules.
 * Currently requires no parameters as it fetches policy-wide configurations.
 */
export const ListDLPRulesSchema = z.object({
  includeHelp: z
    .boolean()
    .optional()
    .describe("Whether to attach policy documentation from Upstash"),
});

/**
 * Schema for enrolling a browser.
 * Requires the target Organizational Unit (OU) ID.
 */
export const EnrollBrowserSchema = z.object({
  orgUnitId: z
    .string()
    .optional()
    .describe(
      'The Org Unit ID (defaults to root if not provided). Example: "id:03ph8a2z1en..."'
    ),
});

/**
 * Schema for fetching connector configurations.
 * Used to diagnose connectivity issues between Chrome and CEP.
 */
export const GetConnectorConfigSchema = z.object({});

/**
 * Inputs for the fleet overview tool.
 */
export const GetFleetOverviewSchema = z.object({
  maxEvents: z
    .number()
    .optional()
    .describe("Max number of recent Chrome events to analyze (default 25)"),
  knowledgeQuery: z
    .string()
    .optional()
    .describe("Optional query to pull related help or policy docs"),
});

/**
 * Structured AI output for the fleet overview.
 */
const FleetOverviewResponseSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  postureCards: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      note: z.string(),
      source: z.string(),
      action: z.string(),
      lastUpdated: z.string().optional(),
    })
  ),
  suggestions: z.array(z.string()),
  sources: z.array(z.string()),
});

export type FleetOverviewResponse = z.infer<typeof FleetOverviewResponseSchema>;

type FleetKnowledgeContext = {
  docs: VectorSearchResult | null;
  policies: VectorSearchResult | null;
};

type FleetOverviewFacts = {
  eventCount: number;
  dlpRuleCount: number;
  connectorPolicyCount: number;
  latestEventAt: string | null;
  errors: string[];
};

/**
 * Extract deterministic fleet signals from tool outputs.
 */
function extractFleetOverviewFacts(
  eventsResult: Awaited<ReturnType<CepToolExecutor["getChromeEvents"]>>,
  dlpResult: Awaited<ReturnType<CepToolExecutor["listDLPRules"]>>,
  connectorResult: Awaited<
    ReturnType<CepToolExecutor["getChromeConnectorConfiguration"]>
  >
): FleetOverviewFacts {
  const events = "events" in eventsResult ? (eventsResult.events ?? []) : [];
  const rules = "rules" in dlpResult ? (dlpResult.rules ?? []) : [];
  const connectorValue =
    "value" in connectorResult ? (connectorResult.value ?? []) : [];

  const errors: string[] = [];
  if ("error" in eventsResult && eventsResult.error) {
    errors.push(`Chrome events: ${eventsResult.error}`);
  }
  if ("error" in dlpResult && dlpResult.error) {
    errors.push(`DLP rules: ${dlpResult.error}`);
  }
  if ("error" in connectorResult && connectorResult.error) {
    errors.push(`Connector policies: ${connectorResult.error}`);
  }

  const latestEventAt =
    events.length > 0 ? (events[0]?.id?.time ?? null) : null;

  return {
    eventCount: events.length,
    dlpRuleCount: rules.length,
    connectorPolicyCount: connectorValue.length,
    latestEventAt,
    errors,
  };
}

/**
 * Use the AI model to synthesize a narrative summary from structured facts.
 * This is the only place where interpretation is performed.
 */
async function summarizeFleetOverview(
  facts: FleetOverviewFacts,
  context: Record<string, unknown>,
  knowledge: FleetKnowledgeContext
): Promise<FleetOverviewResponse> {
  const result = await generateObject({
    model: googleModel("gemini-2.0-flash-001"),
    schema: FleetOverviewResponseSchema,
    system:
      "You are the CEP onboarding assistant. Use the provided facts to describe the fleet state. Do not invent data. If facts are empty or errors exist, state them clearly.",
    prompt: `Facts:\n${JSON.stringify(facts, null, 2)}\n\nContext JSON:\n${JSON.stringify(context, null, 2)}\n\nKnowledge:\n${JSON.stringify(knowledge, null, 2)}\n\nGuidelines:\n- Headline must start with "I just reviewed your Chrome fleet."\n- Summary must reference real counts from facts or explicitly say data is missing.\n- Posture cards must use counts from facts, include a source + action prompt, and include lastUpdated when available.\n- Sources must list the concrete API surfaces used (Admin SDK Reports, Cloud Identity, Chrome Policy).\n- Suggestions must be action-oriented and tied to observed gaps or errors.\n`,
  });

  return result.object;
}

export class CepToolExecutor {
  private auth: GoogleAuth | OAuth2Client;
  private customerId: string;

  /**
   * Initializes the executor.
   *
   * @param accessToken - Required. Uses the signed-in user's token from the web flow.
   * @param customerId - The Google Workspace Customer ID (defaults to 'my_customer' alias).
   */
  constructor(accessToken: string, customerId: string = "my_customer") {
    this.customerId = customerId;

    // Web UI Session (Passed explicitly)
    const client = new OAuth2Client();
    client.setCredentials({ access_token: accessToken });
    this.auth = client;
  }

  /**
   * Fetches recent Chrome audit events (e.g., file uploads, malware transfers) from the Admin SDK Reports API.
   *
   * @param params - The parameters defined in GetChromeEventsSchema.
   * @returns An object containing the list of events or an error message with a suggestion.
   */
  async getChromeEvents({
    maxResults = 10,
  }: z.infer<typeof GetChromeEventsSchema>) {
    console.log("[chrome-events] request", { maxResults });
    const service = googleApis.admin({ version: "reports_v1", auth: this.auth });
    const start = Date.now();
    try {
      const res = await service.activities.list({
        userKey: "all",
        applicationName: "chrome",
        maxResults,
        customerId: this.customerId,
      });
      console.log(
        "[chrome-events] response",
        JSON.stringify({ count: res.data.items?.length ?? 0, sample: res.data.items?.[0]?.id })
      );
      recordActivity({
        id: crypto.randomUUID(),
        url: "https://admin.googleapis.com/admin/reports_v1/activities",
        method: "GET",
        status: 200,
        durationMs: Date.now() - start,
        responsePreview: `items=${res.data.items?.length ?? 0}`,
        timestamp: Date.now(),
        kind: "workspace",
      });
      return { events: res.data.items || [] };
    } catch (error: any) {
      console.log(
        "[chrome-events] error",
        JSON.stringify({ code: error?.code, message: error?.message, errors: error?.errors })
      );
      recordActivity({
        id: crypto.randomUUID(),
        url: "https://admin.googleapis.com/admin/reports_v1/activities",
        method: "GET",
        status: error?.code ?? "error",
        durationMs: Date.now() - start,
        responsePreview: error?.message ?? "Unknown error",
        timestamp: Date.now(),
        kind: "workspace",
      });
      return {
        error: error.message,
        suggestion:
          "Ensure the 'Admin SDK' API is enabled in GCP and the user has 'Reports' privileges.",
      };
    }
  }

  /**
   * Lists the current Data Loss Prevention (DLP) policies configured in Cloud Identity.
   *
   * @returns A normalized list of DLP rules with display metadata.
   */
  async listDLPRules({
    includeHelp = false,
  }: z.infer<typeof ListDLPRulesSchema> = {}) {
    const service = googleApis.cloudidentity({
      version: "v1",
      auth: this.auth,
    });
    console.log("[dlp-rules] request");
    const start = Date.now();
    try {
      const res = await service.policies.list({
        filter: `customer == "customers/${this.customerId}"`,
      });
      console.log(
        "[dlp-rules] response",
        JSON.stringify({ count: res.data.policies?.length ?? 0, sample: res.data.policies?.[0]?.name })
      );

      recordActivity({
        id: crypto.randomUUID(),
        url: "https://cloudidentity.googleapis.com/v1/policies",
        method: "GET",
        status: 200,
        durationMs: Date.now() - start,
        responsePreview: `policies=${res.data.policies?.length ?? 0}`,
        timestamp: Date.now(),
        kind: "workspace",
      });

      const rules = (res.data.policies ?? []).map((policy, idx) => {
        const resourceName = policy.name ?? "";
        const id = resourceName.split("/").pop() ?? `rule-${idx + 1}`;
        const displayName = id;
        const description = "";

        return {
          id,
          displayName,
          description,
          resourceName,
          consoleUrl: "https://admin.google.com/ac/chrome/dlp",
        };
      });

      if (!includeHelp || rules.length === 0) {
        return { rules };
      }

      const help = await searchPolicies("Chrome DLP rules", 4);
      return { rules, help };
    } catch (error: any) {
      console.log(
        "[dlp-rules] error",
        JSON.stringify({ code: error?.code, message: error?.message, errors: error?.errors })
      );
      recordActivity({
        id: crypto.randomUUID(),
        url: "https://cloudidentity.googleapis.com/v1/policies",
        method: "GET",
        status: error?.code ?? "error",
        durationMs: Date.now() - start,
        responsePreview: error?.message ?? "Unknown error",
        timestamp: Date.now(),
        kind: "workspace",
      });
      return {
        error: error.message,
        suggestion:
          "Check 'Cloud Identity API' enablement and DLP Read permissions.",
      };
    }
  }

  /**
   * Generates a new enrollment token for Chrome Browser Cloud Management (CBCM).
   *
   * @param params - The parameters defined in EnrollBrowserSchema.
   * @returns The enrollment token and its expiration date.
   */
  async enrollBrowser({
    orgUnitId: _orgUnitId,
  }: z.infer<typeof EnrollBrowserSchema>) {
    const service = googleApis.chromemanagement({
      version: "v1",
      auth: this.auth,
    });
    console.log("[enroll-browser] request", { orgUnitId: _orgUnitId });
    const start = Date.now();
    try {
      const res = await service.customers.policies.networks.enrollments.create({
        parent: `customers/${this.customerId}`,
        requestBody: {
          policySchemaId: "chrome.users.EnrollmentToken",
          policyTargetKey: {
            targetResource: orgUnitId ?? "customers/my_customer",
          },
        },
      });
      console.log(
        "[enroll-browser] response",
        JSON.stringify({ token: res.data.name ?? "", expires: res.data.expirationTime })
      );
      recordActivity({
        id: crypto.randomUUID(),
        url: "https://chromemanagement.googleapis.com/v1/customers/policies/networks/enrollments",
        method: "POST",
        status: 200,
        durationMs: Date.now() - start,
        responsePreview: res.data.name ?? "",
        timestamp: Date.now(),
        kind: "workspace",
      });
      return {
        enrollmentToken: res.data.name ?? "",
        expiresAt: res.data.expirationTime ?? null,
      };
    } catch (error: any) {
      console.log(
        "[enroll-browser] error",
        JSON.stringify({ code: error?.code, message: error?.message, errors: error?.errors })
      );
      recordActivity({
        id: crypto.randomUUID(),
        url: "https://chromemanagement.googleapis.com/v1/customers/policies/networks/enrollments",
        method: "POST",
        status: error?.code ?? "error",
        durationMs: Date.now() - start,
        responsePreview: error?.message ?? "Unknown error",
        timestamp: Date.now(),
        kind: "workspace",
      });
      return {
        error: error.message,
        suggestion:
          "Ensure 'Chrome Browser Cloud Management API' is enabled and caller has Chrome policy admin rights.",
      };
    }
  }

  /**
   * Retrieves the current Chrome Connector configuration policies.
   *
   * @returns The resolved Chrome Policy values for connector-related schemas.
   */
  async getChromeConnectorConfiguration() {
    const service = googleApis.chromepolicy({
      version: "v1",
      auth: this.auth,
    });

      const policySchemas = [
        "chrome.users.SafeBrowsingProtectionLevel",
        "chrome.users.SafeBrowsingExtendedReporting",
        "chrome.users.SafeBrowsingAllowlistDomain",
        "chrome.users.SafeBrowsingForTrustedSourcesEnabled",
        "chrome.users.SafeBrowsingDeepScanningEnabled",
        "chrome.users.CloudReporting",
        "chrome.users.CloudProfileReportingEnabled",
        "chrome.users.CloudReportingUploadFrequencyV2",
        "chrome.users.MetricsReportingEnabled",
        "chrome.users.DataLeakPreventionReportingEnabled",
      ];

    const start = Date.now();
    try {
      const resolvedPolicies: chromepolicy_v1.Schema$GoogleChromePolicyVersionsV1ResolvedPolicy[] =
        [];

      const directory = googleApis.admin({
        version: "directory_v1",
        auth: this.auth,
      });

      let rootOrgUnitId = "";
      let rootOrgUnitPath = "";
      try {
        const orgUnits = await directory.orgunits.list({
          customerId: this.customerId,
          type: "all",
        });
        const orgUnitsList = orgUnits.data.organizationUnits ?? [];
        const rootOu = orgUnitsList.find((unit) => unit.orgUnitPath === "/");
        rootOrgUnitId = (rootOu?.orgUnitId ?? "").replace(/^id:/, "");
        rootOrgUnitPath = rootOu?.orgUnitPath ?? "";
      if (!rootOrgUnitId && orgUnitsList.length > 0) {
        rootOrgUnitId = (orgUnitsList[0]?.orgUnitId ?? "").replace(/^id:/, "");
      }
      if (!rootOrgUnitId && orgUnitsList.length > 0) {
        rootOrgUnitId = (orgUnitsList[0]?.parentOrgUnitId ?? "").replace(/^id:/, "");
      }
      if (!rootOrgUnitPath && orgUnitsList.length > 0) {
        rootOrgUnitPath = orgUnitsList[0]?.orgUnitPath ?? "";
      }
      if (!rootOrgUnitPath && rootOrgUnitId) {
        rootOrgUnitPath = "/";
      }
      } catch (error) {
        console.log(
          "[connector-config] root-ou error",
          JSON.stringify({ message: (error as Error).message })
        );
      }

      const targetCandidates = [
        rootOrgUnitId ? `orgunits/${rootOrgUnitId}` : "",
        rootOrgUnitPath ? `orgunits/${rootOrgUnitPath}` : "",
        rootOrgUnitPath ? `orgunits/${encodeURIComponent(rootOrgUnitPath)}` : "",
        rootOrgUnitPath ? `orgunits/${rootOrgUnitPath.replace(/^\//, "")}` : "",
      ].filter(Boolean);

      const resolveErrors: Array<{ targetResource: string; message: string }> = [];
      for (const targetResource of targetCandidates) {
        try {
          const res = await service.customers.policies.resolve({
            customer: `customers/${this.customerId}`,
            requestBody: {
              policySchemaFilter: policySchemas.join(","),
              pageSize: 100,
              policyTargetKey: {
                targetResource,
              },
            },
          });

          console.log(
            "[connector-config] response",
            JSON.stringify({
              targetResource,
              count: res.data.resolvedPolicies?.length ?? 0,
              sample: res.data.resolvedPolicies?.[0]?.policyTargetKey,
            })
          );

          recordActivity({
            id: crypto.randomUUID(),
            url: "https://chromepolicy.googleapis.com/v1/customers/policies:resolve",
            method: "POST",
            status: 200,
            durationMs: Date.now() - start,
            responsePreview: `policies=${res.data.resolvedPolicies?.length ?? 0}`,
            timestamp: Date.now(),
            kind: "workspace",
          });

          resolvedPolicies.push(...(res.data.resolvedPolicies ?? []));

          return {
            status: "Resolved",
            policySchemas,
            value: resolvedPolicies,
            targetResource,
          };
        } catch (error) {
          resolveErrors.push({
            targetResource,
            message: (error as Error).message,
          });
        }
      }

      if (resolveErrors.length > 0) {
        return {
          status: "Resolved",
          policySchemas,
          value: [],
          errors: resolveErrors,
        };
      }

      return {
        status: "Resolved",
        policySchemas,
        value: [],
      };
    } catch (error: any) {
      console.log(
        "[connector-config] error",
        JSON.stringify({
          code: error?.code,
          message: error?.message,
          errors: error?.errors,
        })
      );
      recordActivity({
        id: crypto.randomUUID(),
        url: "https://chromepolicy.googleapis.com/v1/customers/policies:resolve",
        method: "POST",
        status: error?.code ?? "error",
        durationMs: Date.now() - start,
        responsePreview: error?.message ?? "Unknown error",
        timestamp: Date.now(),
        kind: "workspace",
      });
      return {
        error: error.message,
        suggestion:
          "Check Chrome Policy API permissions and policy schema access.",
        policySchemas,
      };
    }
  }

  /**
   * Fetches related documentation for grounding overview responses.
   */
  async getKnowledgeContext(query: string): Promise<FleetKnowledgeContext> {
    if (!query.trim()) {
      return { docs: null, policies: null };
    }

    const [docs, policies] = await Promise.all([
      searchDocs(query, 3),
      searchPolicies(query, 3),
    ]);

    return { docs, policies };
  }

  async getFleetOverview({
    maxEvents = 25,
    knowledgeQuery,
  }: z.infer<typeof GetFleetOverviewSchema>) {
    const [eventsResult, dlpResult, connectorResult] = await Promise.all([
      this.getChromeEvents({ maxResults: maxEvents }),
      this.listDLPRules(),
      this.getChromeConnectorConfiguration(),
    ]);

    const dataPayload = {
      eventsResult,
      dlpResult,
      connectorResult,
    };

    const facts = extractFleetOverviewFacts(
      eventsResult,
      dlpResult,
      connectorResult
    );

    const knowledge = await this.getKnowledgeContext(knowledgeQuery ?? "");

    try {
      const summary = await summarizeFleetOverview(
        facts,
        dataPayload,
        knowledge
      );

      return summary;
    } catch (error) {
      return {
        headline: "I just reviewed your Chrome fleet.",
        summary:
          "I could not synthesize a full summary, but here is what I can see.",
        postureCards: [
          {
            label: "Recent events",
            value: `${facts.eventCount}`,
            note: "Chrome activity logs",
            source: "Admin SDK Reports",
            action: "Show recent Chrome events",
            lastUpdated: facts.latestEventAt ?? new Date().toISOString(),
          },
          {
            label: "DLP rules",
            value: `${facts.dlpRuleCount}`,
            note: "Customer DLP policies",
            source: "Cloud Identity",
            action: "List active DLP rules",
            lastUpdated: new Date().toISOString(),
          },
          {
            label: "Connector policies",
            value: `${facts.connectorPolicyCount}`,
            note: "Connector policy resolve",
            source: "Chrome Policy",
            action: "Check connector configuration",
            lastUpdated: new Date().toISOString(),
          },
        ],
        suggestions: [
          "List active DLP rules",
          "Show recent Chrome events",
          "Check connector configuration",
        ],
        sources: ["Admin SDK Reports", "Cloud Identity", "Chrome Policy"],
      };
    }
  }
}
