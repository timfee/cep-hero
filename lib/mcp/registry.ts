import { google as googleModel } from "@ai-sdk/google";
import { generateObject } from "ai";
import { OAuth2Client } from "google-auth-library";
import { google as googleApis, chromepolicy_v1 } from "googleapis";
import { z } from "zod";

import type { VectorSearchResult } from "@/lib/upstash/search";

import { writeDebugLog } from "@/lib/debug-log";
import { searchDocs, searchPolicies } from "@/lib/upstash/search";

import { recordActivity } from "../activity-log";

/**
 * Schema for fetching Chrome audit events.
 */
export const GetChromeEventsSchema = z.object({
  maxResults: z
    .number()
    .optional()
    .describe("Number of events to fetch (default 10)"),
  pageToken: z
    .string()
    .optional()
    .describe("Optional page token for pagination"),
});

/**
 * Schema for listing DLP rules.
 */
export const ListDLPRulesSchema = z.object({
  includeHelp: z
    .boolean()
    .optional()
    .describe("Whether to attach policy documentation from Upstash"),
});

/**
 * Schema for enrolling a browser.
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

type ResolvedPolicy =
  chromepolicy_v1.Schema$GoogleChromePolicyVersionsV1ResolvedPolicy & {
    policyTargetKey?: { targetResource?: string };
  };

type OrgUnit = {
  orgUnitId?: string | null;
  parentOrgUnitId?: string | null;
  orgUnitPath?: string | null;
};

function normalizeResource(value: string): string {
  const trimmed = value.trim();
  const stripped = trimmed.replace(/^id:/, "");
  return stripped.replace(/\/{2,}/g, "/");
}

function buildOrgUnitTargetResource(value: string): string {
  const normalized = normalizeResource(value);
  if (!normalized || normalized === "/") {
    return "";
  }
  const withoutLeading = normalized.startsWith("/")
    ? normalized.slice(1)
    : normalized;
  if (
    withoutLeading.startsWith("orgunits/") ||
    withoutLeading.startsWith("customers/")
  ) {
    return normalizeResource(withoutLeading);
  }
  return normalizeResource(`orgunits/${withoutLeading}`);
}

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
  private auth: OAuth2Client;
  private customerId: string;

  /**
   * Initialize the executor with a signed-in user's access token.
   */
  constructor(accessToken: string, customerId: string = "my_customer") {
    this.customerId = customerId;

    const client = new OAuth2Client();
    client.setCredentials({ access_token: accessToken });
    this.auth = client;
  }

  private async logApi(event: string, payload: Record<string, unknown>) {
    await writeDebugLog(event, payload);
  }

  /**
   * Fetch recent Chrome audit events from the Admin SDK Reports API.
   */
  async getChromeEvents({
    maxResults = 10,
    pageToken,
  }: z.infer<typeof GetChromeEventsSchema>) {
    console.log("[chrome-events] request", { maxResults, pageToken });
    await this.logApi("google.request.chrome-events", {
      endpoint: "https://admin.googleapis.com/admin/reports_v1/activities",
      method: "GET",
      params: { maxResults, pageToken, customerId: this.customerId },
    });
    const service = googleApis.admin({
      version: "reports_v1",
      auth: this.auth,
    });
    const start = Date.now();
    try {
      const res = await service.activities.list({
        userKey: "all",
        applicationName: "chrome",
        maxResults,
        customerId: this.customerId,
        pageToken,
      });
      console.log(
        "[chrome-events] response",
        JSON.stringify({
          count: res.data.items?.length ?? 0,
          sample: res.data.items?.[0]?.id,
          nextPageToken: res.data.nextPageToken ?? null,
        })
      );
      recordActivity({
        id: crypto.randomUUID(),
        url: "https://admin.googleapis.com/admin/reports_v1/activities",
        method: "GET",
        status: 200,
        durationMs: Date.now() - start,
        responsePreview: `items=${res.data.items?.length ?? 0}, nextPageToken=${res.data.nextPageToken ?? ""}`,
        timestamp: Date.now(),
        kind: "workspace",
      });
      await this.logApi("google.response.chrome-events", {
        status: "ok",
        count: res.data.items?.length ?? 0,
        sample: res.data.items?.[0]?.id,
        nextPageToken: res.data.nextPageToken ?? null,
      });
      return {
        events: res.data.items || [],
        nextPageToken: res.data.nextPageToken ?? null,
      };
    } catch (error: unknown) {
      const { code, message, errors } = getErrorDetails(error);
      console.log(
        "[chrome-events] error",
        JSON.stringify({ code, message, errors })
      );
      await this.logApi("google.error.chrome-events", {
        code,
        message,
        errors,
        pageToken,
      });
      recordActivity({
        id: crypto.randomUUID(),
        url: "https://admin.googleapis.com/admin/reports_v1/activities",
        method: "GET",
        status: normalizeStatus(code),
        durationMs: Date.now() - start,
        responsePreview: message ?? "Unknown error",
        timestamp: Date.now(),
        kind: "workspace",
      });
      return {
        error: message ?? "Unknown error",
        suggestion:
          "Ensure the 'Admin SDK' API is enabled in GCP and the user has 'Reports' privileges.",
      };
    }
  }

  /**
   * List DLP policies configured in Cloud Identity.
   */
  async listDLPRules({
    includeHelp = false,
  }: z.infer<typeof ListDLPRulesSchema> = {}) {
    const service = googleApis.cloudidentity({
      version: "v1",
      auth: this.auth,
    });
    console.log("[dlp-rules] request");
    await this.logApi("google.request.dlp-rules", {
      endpoint: "https://cloudidentity.googleapis.com/v1/policies",
      method: "GET",
      params: { customerId: this.customerId, includeHelp },
    });
    const start = Date.now();
    try {
      if (!service.policies?.list) {
        return {
          error: "Cloud Identity policy client unavailable",
          suggestion: "Confirm Cloud Identity API is enabled for this project.",
        };
      }

      const res = await service.policies.list({
        filter: `customer == "customers/${this.customerId}"`,
      });
      console.log(
        "[dlp-rules] response",
        JSON.stringify({
          count: res.data.policies?.length ?? 0,
          sample: res.data.policies?.[0]?.name,
        })
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
      await this.logApi("google.response.dlp-rules", {
        status: "ok",
        count: res.data.policies?.length ?? 0,
        sample: res.data.policies?.[0]?.name,
      });

      const rules = (res.data.policies ?? []).map(
        (policy: { name?: string | null }, idx: number) => {
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
        }
      );

      if (!includeHelp || rules.length === 0) {
        return { rules };
      }

      const help = await searchPolicies("Chrome DLP rules", 4);
      return { rules, help };
    } catch (error: unknown) {
      const { code, message, errors } = getErrorDetails(error);
      console.log(
        "[dlp-rules] error",
        JSON.stringify({ code, message, errors })
      );
      await this.logApi("google.error.dlp-rules", {
        code,
        message,
        errors,
      });
      recordActivity({
        id: crypto.randomUUID(),
        url: "https://cloudidentity.googleapis.com/v1/policies",
        method: "GET",
        status: normalizeStatus(code),
        durationMs: Date.now() - start,
        responsePreview: message ?? "Unknown error",
        timestamp: Date.now(),
        kind: "workspace",
      });
      return {
        error: message ?? "Unknown error",
        suggestion:
          "Check 'Cloud Identity API' enablement and DLP Read permissions.",
      };
    }
  }

  /**
   * Generate a new enrollment token for Chrome Browser Cloud Management.
   */
  async enrollBrowser({ orgUnitId }: z.infer<typeof EnrollBrowserSchema>) {
    const service = googleApis.chromemanagement({
      version: "v1",
      auth: this.auth,
    });
    type EnrollmentCreate = (args: {
      parent: string;
      requestBody: {
        policySchemaId: string;
        policyTargetKey: { targetResource: string };
      };
    }) => Promise<{
      data: { name?: string | null; expirationTime?: string | null };
    }>;

    const customers = service.customers as unknown as {
      policies?: {
        networks?: { enrollments?: { create?: EnrollmentCreate } };
      };
    };
    const normalizedTargetResource = orgUnitId
      ? buildOrgUnitTargetResource(orgUnitId)
      : "";
    const targetResource = normalizedTargetResource || "customers/my_customer";
    console.log("[enroll-browser] request", { orgUnitId, targetResource });
    await this.logApi("google.request.enroll-browser", {
      endpoint:
        "https://chromemanagement.googleapis.com/v1/customers/policies/networks/enrollments",
      method: "POST",
      body: {
        customer: this.customerId,
        orgUnitId,
        targetResource,
      },
    });
    const start = Date.now();
    try {
      if (!customers.policies?.networks?.enrollments?.create) {
        return {
          error: "Chrome Management enrollment client unavailable",
          suggestion:
            "Confirm Chrome Management API is enabled and the account has enrollment permissions.",
        };
      }

      const res = await customers.policies.networks.enrollments.create({
        parent: `customers/${this.customerId}`,
        requestBody: {
          policySchemaId: "chrome.users.EnrollmentToken",
          policyTargetKey: {
            targetResource,
          },
        },
      });
      console.log(
        "[enroll-browser] response",
        JSON.stringify({
          token: res.data.name ?? "",
          expires: res.data.expirationTime,
        })
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
      await this.logApi("google.response.enroll-browser", {
        status: "ok",
        token: res.data.name ?? "",
        expires: res.data.expirationTime,
      });
      return {
        enrollmentToken: res.data.name ?? "",
        expiresAt: res.data.expirationTime ?? null,
      };
    } catch (error: unknown) {
      const { code, message, errors } = getErrorDetails(error);
      console.log(
        "[enroll-browser] error",
        JSON.stringify({ code, message, errors })
      );
      await this.logApi("google.error.enroll-browser", {
        code,
        message,
        errors,
      });
      recordActivity({
        id: crypto.randomUUID(),
        url: "https://chromemanagement.googleapis.com/v1/customers/policies/networks/enrollments",
        method: "POST",
        status: normalizeStatus(code),
        durationMs: Date.now() - start,
        responsePreview: message ?? "Unknown error",
        timestamp: Date.now(),
        kind: "workspace",
      });
      return {
        error: message ?? "Unknown error",
        suggestion:
          "Ensure 'Chrome Browser Cloud Management API' is enabled and caller has Chrome policy admin rights.",
      };
    }
  }

  /**
   * Retrieve Chrome Connector configuration policies.
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
    await this.logApi("google.request.connector-config", {
      endpoint:
        "https://chromepolicy.googleapis.com/v1/customers/policies:resolve",
      method: "POST",
      policySchemas,
      customerId: this.customerId,
    });
    let targetCandidates: string[] = [];
    const attemptedTargets: string[] = [];
    try {
      const resolvedPolicies: ResolvedPolicy[] = [];

      const directory = googleApis.admin({
        version: "directory_v1",
        auth: this.auth,
      });

      let ouFetchError: string | null = null;
      try {
        if (!directory.orgunits?.list) {
          throw new Error("Directory orgunit client unavailable");
        }
        const orgUnits = await directory.orgunits.list({
          customerId: this.customerId,
          type: "all",
        });
        const orgUnitIds = resolveOrgUnitCandidates(
          orgUnits?.data.organizationUnits ?? []
        );
        targetCandidates = orgUnitIds
          .map((id) => buildOrgUnitTargetResource(id))
          .filter((t) => t !== "");
      } catch (error) {
        ouFetchError = getErrorMessage(error);
        console.log(
          "[connector-config] root-ou error",
          JSON.stringify({ message: ouFetchError })
        );
      }

      if (targetCandidates.length === 0) {
        return {
          error: "Could not determine policy target (root org unit).",
          detail:
            ouFetchError ??
            "No organization units were returned; ensure the token can read org units.",
          suggestion:
            "Re-authenticate with https://www.googleapis.com/auth/admin.directory.orgunit scope and retry.",
          policySchemas,
        };
      }

      const resolveErrors: Array<{ targetResource: string; message: string }> =
        [];
      for (const targetResource of targetCandidates) {
        attemptedTargets.push(targetResource);
        try {
          await this.logApi("google.request.connector-config", {
            endpoint:
              "https://chromepolicy.googleapis.com/v1/customers/policies:resolve",
            method: "POST",
            policySchemas,
            customerId: this.customerId,
            targetResource,
          });
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
              sampleTargetResource: getPolicyTargetResource(
                res.data.resolvedPolicies?.[0]
              ),
            })
          );

          recordActivity({
            id: crypto.randomUUID(),
            url: "https://chromepolicy.googleapis.com/v1/customers/policies:resolve",
            method: "POST",
            status: 200,
            durationMs: Date.now() - start,
            responsePreview: `policies=${res.data.resolvedPolicies?.length ?? 0}, target=${targetResource}`,
            timestamp: Date.now(),
            kind: "workspace",
          });

          resolvedPolicies.push(...(res.data.resolvedPolicies ?? []));

          await this.logApi("google.response.connector-config", {
            status: "ok",
            targetResource,
            count: res.data.resolvedPolicies?.length ?? 0,
            sampleTargetResource: getPolicyTargetResource(
              res.data.resolvedPolicies?.[0]
            ),
          });

          return {
            status: "Resolved",
            policySchemas,
            value: resolvedPolicies,
            targetResource,
            attemptedTargets,
          };
        } catch (error) {
          const message = getErrorMessage(error);
          recordActivity({
            id: crypto.randomUUID(),
            url: "https://chromepolicy.googleapis.com/v1/customers/policies:resolve",
            method: "POST",
            status: normalizeStatus(getErrorDetails(error).code),
            durationMs: Date.now() - start,
            responsePreview: `target=${targetResource}, error=${message}`,
            timestamp: Date.now(),
            kind: "workspace",
          });
          await this.logApi("google.error.connector-config", {
            message,
            targetResource,
          });
          resolveErrors.push({
            targetResource,
            message,
          });
        }
      }

      if (resolveErrors.length > 0) {
        return {
          status: "Resolved",
          policySchemas,
          value: [],
          errors: resolveErrors,
          targetResource: resolveErrors[0]?.targetResource,
          attemptedTargets,
        };
      }

      await this.logApi("google.response.connector-config", {
        status: "ok",
        targetResource: null,
        count: 0,
        resolveErrors,
        attemptedTargets,
      });

      return {
        status: "Resolved",
        policySchemas,
        value: [],
        targetResource: attemptedTargets[0],
        attemptedTargets,
      };
    } catch (error: unknown) {
      const { code, message, errors } = getErrorDetails(error);
      console.log(
        "[connector-config] error",
        JSON.stringify({
          code,
          message,
          errors,
        })
      );
      recordActivity({
        id: crypto.randomUUID(),
        url: "https://chromepolicy.googleapis.com/v1/customers/policies:resolve",
        method: "POST",
        status: normalizeStatus(code),
        durationMs: Date.now() - start,
        responsePreview: message ?? "Unknown error",
        timestamp: Date.now(),
        kind: "workspace",
      });
      await this.logApi("google.error.connector-config", {
        code,
        message,
        errors,
      });
      return {
        error: message ?? "Unknown error",
        suggestion:
          "Check Chrome Policy API permissions and policy schema access.",
        policySchemas,
        targetResource: attemptedTargets[0],
        attemptedTargets,
      };
    }
  }

  /**
   * Debug the current access token scopes and expiry.
   */
  async debugAuth() {
    const start = Date.now();
    const token = await this.auth.getAccessToken();
    const accessToken = token?.token;

    if (!accessToken) {
      return { error: "No access token available in client" };
    }

    try {
      await this.logApi("google.request.debug-auth", {
        endpoint: "https://www.googleapis.com/oauth2/v1/tokeninfo",
        method: "GET",
      });
      const res = await fetch(
        `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
      );
      const data = (await res.json()) as {
        scope?: string;
        expires_in?: number;
        issued_to?: string;
        audience?: string;
        error?: string;
      };

      recordActivity({
        id: crypto.randomUUID(),
        url: "https://www.googleapis.com/oauth2/v1/tokeninfo",
        method: "GET",
        status: res.status,
        durationMs: Date.now() - start,
        responsePreview: data.scope ?? data.error ?? "(no scope)",
        timestamp: Date.now(),
        kind: "workspace",
      });

      await this.logApi("google.response.debug-auth", {
        status: res.status,
        scope: data.scope,
        issuedTo: data.issued_to ?? data.audience,
        error: data.error,
      });

      if (!res.ok || data.error) {
        return { error: data.error ?? `tokeninfo ${res.status}` };
      }

      return {
        scope: data.scope ?? "",
        expiresIn: data.expires_in,
        issuedTo: data.issued_to ?? data.audience,
      };
    } catch (error) {
      await this.logApi("google.error.debug-auth", {
        error: getErrorMessage(error),
      });
      return { error: getErrorMessage(error) };
    }
  }

  /**
   * Fetch related documentation for grounding overview responses.
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

  /**
   * Summarize fleet posture from live CEP data.
   */
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
    } catch {
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

/**
 * Normalize error details from API exceptions.
 */
function getErrorDetails(error: unknown): {
  code?: number | string;
  message?: string;
  errors?: unknown;
} {
  if (!error || typeof error !== "object") {
    return {};
  }

  const code = Reflect.get(error, "code");
  const message = Reflect.get(error, "message");
  const errors = Reflect.get(error, "errors");

  return {
    code:
      typeof code === "number" || typeof code === "string" ? code : undefined,
    message: typeof message === "string" ? message : undefined,
    errors,
  };
}

/**
 * Extract a readable message from unknown errors.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  const message =
    error && typeof error === "object"
      ? Reflect.get(error, "message")
      : undefined;

  return typeof message === "string" ? message : "Unknown error";
}

/**
 * Resolve org unit IDs to try for Chrome Policy API.
 * Returns an array of org unit IDs to try, in order of preference:
 * 1. parentOrgUnitId (root) - if available
 * 2. First few child org unit IDs - as fallback if root isn't enrolled in CBCM
 *
 * The root org unit (path="/") typically doesn't appear in orgunits.list() results.
 * Instead, all child org units share the same parentOrgUnitId which IS the root.
 * However, the root might not be enrolled in Chrome Browser Cloud Management,
 * so we also try child org units as fallback.
 */
function resolveOrgUnitCandidates(units: OrgUnit[]): string[] {
  if (units.length === 0) {
    return [];
  }

  const candidates: string[] = [];
  const seen = new Set<string>();

  const firstUnit = units[0];
  const rootId = normalizeResource(
    firstUnit?.parentOrgUnitId ?? firstUnit?.orgUnitId ?? ""
  );
  if (rootId && !seen.has(rootId)) {
    candidates.push(rootId);
    seen.add(rootId);
  }

  for (const unit of units.slice(0, 3)) {
    const childId = normalizeResource(unit.orgUnitId ?? "");
    if (childId && !seen.has(childId)) {
      candidates.push(childId);
      seen.add(childId);
    }
  }

  return candidates;
}

/**
 * Read target resource from a resolved policy.
 */
function getPolicyTargetResource(policy?: ResolvedPolicy): string | undefined {
  const targetResource = policy?.policyTargetKey?.targetResource;
  return typeof targetResource === "string" ? targetResource : undefined;
}

/**
 * Normalize error codes for activity logging.
 */
function normalizeStatus(code?: number | string): number | "error" {
  return typeof code === "number" ? code : "error";
}
