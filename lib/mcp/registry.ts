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
 * Schema for listing Org Units.
 */
export const ListOrgUnitsSchema = z.object({});

/**
 * Schema for drafting a policy change for user review.
 * This tool does NOT execute changes - it returns a structured proposal
 * that the UI renders as a confirmation card.
 */
export const DraftPolicyChangeSchema = z.object({
  policyName: z.string().describe("The human-readable name of the policy"),
  proposedValue: z.any().describe("The JSON value to set"),
  targetUnit: z
    .string()
    .describe("The Org Unit ID or path to apply this policy to"),
  reasoning: z.string().describe("Why this change is recommended"),
  adminConsoleUrl: z
    .string()
    .optional()
    .describe("Direct link to Admin Console page for manual configuration"),
});

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
      status: z
        .enum(["healthy", "warning", "critical", "info"])
        .optional()
        .describe("Visual status indicator for the card"),
      progress: z
        .number()
        .min(0)
        .max(100)
        .optional()
        .describe("Progress percentage (0-100) if applicable"),
      priority: z
        .number()
        .min(1)
        .max(10)
        .optional()
        .describe("Priority for sorting (1=highest, 10=lowest)"),
    })
  ),
  suggestions: z.array(
    z.object({
      text: z.string().describe("The suggestion text"),
      action: z.string().describe("The command to execute when clicked"),
      priority: z
        .number()
        .min(1)
        .max(10)
        .describe("Priority for sorting (1=highest)"),
      category: z
        .enum(["security", "compliance", "monitoring", "optimization"])
        .describe("Category of the suggestion"),
    })
  ),
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
    system: `You are the Chrome Enterprise Premium assistant (CEP assistant) - a knowledgeable Chrome Enterprise Premium expert who helps IT admins secure and manage their browser fleet. You're direct, helpful, and focused on actionable insights. Never be generic or vague.`,
    prompt: `Analyze this Chrome Enterprise fleet data and generate a compelling overview.

## Fleet Facts
${JSON.stringify(facts, null, 2)}

## Raw API Data
${JSON.stringify(context, null, 2)}

## Knowledge Context
${JSON.stringify(knowledge, null, 2)}

## Output Requirements

### Headline
Write a single sentence that captures the most important insight about this fleet. Make it specific, insight-driven, and grounded in the data. Examples:
- "Your fleet has 50 DLP rules but no connector policies - data may be leaking."
- "I found 3 security gaps that need your attention."
- "Your Chrome fleet looks healthy, but event reporting could be improved."
Avoid overly generic headlines; focus on what's most actionable or notable.

### Summary
2-3 sentences explaining the current state. Be specific about what's configured and what's missing. Reference actual numbers. If there are issues, lead with them.

### Posture Cards (generate 3-5 cards, prioritized by importance)
Each card should represent a meaningful security or compliance metric:

1. **DLP Coverage** - Are DLP rules configured? How many? Status: healthy if >0 rules, warning if 0.
2. **Event Monitoring** - Are Chrome events being captured? Status based on event count and recency.
3. **Connector Policies** - Are data connectors configured? Status: critical if 0, healthy if configured.
4. **Browser Security** - Cookie encryption, incognito mode, Safe Browsing status (infer from connector policies if available).

For each card:
- \`label\`: Clear, human name (e.g., "Data Protection Rules", "Security Events", "Connector Status")
- \`value\`: The metric (e.g., "50 rules", "10 events", "Not configured")
- \`note\`: Contextual, human-readable insight (NOT dates like "2026-01-20", but things like "Protecting sensitive data" or "No rules configured yet")
- \`status\`: "healthy" (green), "warning" (yellow), "critical" (red), or "info" (blue)
- \`progress\`: Optional 0-100 percentage if applicable
- \`priority\`: 1-10 (1=most important, show critical issues first)
- \`action\`: Command to run when clicked (e.g., "List data protection rules", "Show recent security events")
- \`lastUpdated\`: ISO timestamp if available

### Suggestions (generate 2-4 actionable suggestions based on gaps)
Prioritize by impact. Each suggestion must have:
- \`text\`: Clear, action-oriented text explaining what to do and why
- \`action\`: The exact command to execute
- \`priority\`: 1-10 (1=most urgent)
- \`category\`: "security", "compliance", "monitoring", or "optimization"

**Suggestion Examples Based on Common Gaps:**
- If dlpRuleCount is 0: "Set up a DLP audit rule to monitor all traffic for sensitive data like SSNs and credit cards"
- If connectorPolicyCount is 0: "Configure connector policies to enable real-time data protection"
- If eventCount is low: "Enable Chrome event reporting to get visibility into browser activity"
- If events exist but no DLP: "Your fleet is generating events but has no DLP rules - add rules to protect sensitive data"

Do NOT suggest generic things like "Review connector settings" - be specific about what action to take and why.

### Sources
List the actual API sources used: "Admin SDK Reports", "Cloud Identity", "Chrome Policy"
`,
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
   * List all organizational units for the customer.
   */
  async listOrgUnits() {
    const service = googleApis.admin({
      version: "directory_v1",
      auth: this.auth,
    });

    console.log("[org-units] request");
    await this.logApi("google.request.org-units", {
      endpoint:
        "https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits",
      method: "GET",
      params: { customerId: this.customerId, type: "all" },
    });

    const start = Date.now();
    try {
      if (!service.orgunits?.list) {
        return {
          error: "Directory orgunit client unavailable",
          suggestion: "Confirm Admin SDK is enabled and has correct scopes.",
        };
      }

      const res = await service.orgunits.list({
        customerId: this.customerId,
        type: "all",
      });

      console.log(
        "[org-units] response",
        JSON.stringify({
          count: res.data.organizationUnits?.length ?? 0,
        })
      );

      recordActivity({
        id: crypto.randomUUID(),
        url: "https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits",
        method: "GET",
        status: 200,
        durationMs: Date.now() - start,
        responsePreview: `units=${res.data.organizationUnits?.length ?? 0}`,
        timestamp: Date.now(),
        kind: "workspace",
      });

      await this.logApi("google.response.org-units", {
        status: "ok",
        count: res.data.organizationUnits?.length ?? 0,
      });

      // Map to a cleaner structure
      const units = (res.data.organizationUnits ?? []).map((ou) => ({
        orgUnitId: ou.orgUnitId,
        name: ou.name,
        orgUnitPath: ou.orgUnitPath,
        parentOrgUnitId: ou.parentOrgUnitId,
        description: ou.description,
      }));

      return { orgUnits: units };
    } catch (error: unknown) {
      const { code, message, errors } = getErrorDetails(error);
      console.log(
        "[org-units] error",
        JSON.stringify({ code, message, errors })
      );
      await this.logApi("google.error.org-units", {
        code,
        message,
        errors,
      });
      recordActivity({
        id: crypto.randomUUID(),
        url: "https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits",
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
          "Check 'Admin SDK' enablement and Org Unit Read permissions.",
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
        let rootOuId: string | null = null;
        try {
          // Explicitly fetch the root OU ID to ensure we have the correct target
          const rootRes = await directory.orgunits.get({
            customerId: this.customerId,
            orgUnitPath: "/",
          });
          rootOuId = rootRes.data.orgUnitId ?? null;
        } catch (e) {
          console.log(
            "[connector-config] explicit root-ou fetch failed",
            getErrorMessage(e)
          );
        }

        const orgUnits = await directory.orgunits.list({
          customerId: this.customerId,
          type: "all",
        });

        const orgUnitIds = resolveOrgUnitCandidates(
          orgUnits?.data.organizationUnits ?? []
        );

        if (rootOuId) {
          const normalizedRoot = normalizeResource(rootOuId);
          if (!orgUnitIds.includes(normalizedRoot)) {
            orgUnitIds.unshift(normalizedRoot);
          }
        }

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

        // The resolve endpoint only supports 'orgunits' or 'groups'.
        if (targetResource.startsWith("customers/")) {
          continue;
        }

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
          const isIgnorable =
            message.includes("Requested entity was not found") ||
            message.includes("must be of type 'orgunits' or 'groups'");

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

          if (!isIgnorable) {
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
   * Draft a policy change for user review.
   * This does NOT execute changes - it returns a structured proposal
   * that the UI renders as a confirmation card for the user to approve.
   */
  async draftPolicyChange(args: z.infer<typeof DraftPolicyChangeSchema>) {
    return {
      _type: "ui.confirmation" as const,
      title: `Proposed Change: ${args.policyName}`,
      description: args.reasoning,
      diff: args.proposedValue,
      target: args.targetUnit,
      adminConsoleUrl:
        args.adminConsoleUrl ?? "https://admin.google.com/ac/chrome/settings",
      intent: "update_policy",
      status: "pending_approval",
    };
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
      const hasDlpRules = facts.dlpRuleCount > 0;
      const hasConnectors = facts.connectorPolicyCount > 0;
      const hasEvents = facts.eventCount > 0;

      const suggestions: FleetOverviewResponse["suggestions"] = [];

      if (!hasDlpRules) {
        suggestions.push({
          text: "Set up a DLP audit rule to monitor all traffic for sensitive data like SSNs and credit cards",
          action: "Help me set up DLP to audit all traffic for sensitive data",
          priority: 1,
          category: "security",
        });
      }

      if (!hasConnectors) {
        suggestions.push({
          text: "Configure connector policies to enable real-time data protection across your fleet",
          action: "Help me configure connector policies for data protection",
          priority: 2,
          category: "security",
        });
      }

      if (!hasEvents) {
        suggestions.push({
          text: "Enable Chrome event reporting to get visibility into browser activity",
          action: "How do I enable Chrome event reporting?",
          priority: 3,
          category: "monitoring",
        });
      }

      if (suggestions.length === 0) {
        suggestions.push({
          text: "Review your security posture and identify optimization opportunities",
          action: "Analyze my fleet security posture",
          priority: 5,
          category: "optimization",
        });
      }

      const missingItems = [
        !hasDlpRules && "DLP rules",
        !hasConnectors && "connector policies",
      ].filter(Boolean);

      const headline =
        hasDlpRules && hasConnectors
          ? "Your Chrome fleet is configured, but let's verify everything is working."
          : missingItems.length === 2
            ? "Your fleet is missing DLP rules and connector policies - your data may not be protected."
            : `Your fleet has no ${missingItems[0]} configured - this is a security gap.`;

      return {
        headline,
        summary:
          "I could not generate a full AI summary, but here's what I found from your fleet data.",
        postureCards: [
          {
            label: "Data Protection Rules",
            value:
              facts.dlpRuleCount > 0
                ? `${facts.dlpRuleCount} rules`
                : "Not configured",
            note: hasDlpRules
              ? "Protecting sensitive data"
              : "No rules to detect sensitive data",
            source: "Cloud Identity",
            action: "List data protection rules",
            lastUpdated: new Date().toISOString(),
            status: hasDlpRules ? "healthy" : "critical",
            priority: hasDlpRules ? 3 : 1,
          },
          {
            label: "Security Events",
            value:
              facts.eventCount > 0 ? `${facts.eventCount} events` : "No events",
            note: hasEvents
              ? "Browser activity being monitored"
              : "Event reporting may be disabled",
            source: "Admin SDK Reports",
            action: "Show recent security events",
            lastUpdated: facts.latestEventAt ?? new Date().toISOString(),
            status: hasEvents ? "healthy" : "warning",
            priority: hasEvents ? 4 : 2,
          },
          {
            label: "Connector Policies",
            value:
              facts.connectorPolicyCount > 0
                ? `${facts.connectorPolicyCount} policies`
                : "Not configured",
            note: hasConnectors
              ? "Data connectors active"
              : "No connector policies configured",
            source: "Chrome Policy",
            action: "Review connector configuration",
            lastUpdated: new Date().toISOString(),
            status: hasConnectors ? "healthy" : "critical",
            priority: hasConnectors ? 5 : 3,
          },
        ],
        suggestions,
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
