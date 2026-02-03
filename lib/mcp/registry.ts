/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import { google as googleModel } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { OAuth2Client } from "google-auth-library";
import { google as googleApis, type chromepolicy_v1 } from "googleapis";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import {
  searchDocs,
  searchPolicies,
  type VectorSearchResult,
} from "@/lib/upstash/search";

/**
 * Schema for fetching Chrome audit events.
 */
export const GetChromeEventsSchema = z.object({
  maxResults: z
    .number()
    .optional()
    .describe("Number of events to fetch (default 50)"),
  startTime: z
    .string()
    .optional()
    .describe(
      "Optional RFC3339 timestamp to filter events starting at this time"
    ),
  endTime: z
    .string()
    .optional()
    .describe("Optional RFC3339 timestamp to filter events up to this time"),
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
 * Schema for applying a policy change (after user confirmation).
 * This tool executes the actual policy modification via Chrome Policy API.
 */
export const ApplyPolicyChangeSchema = z.object({
  policySchemaId: z
    .string()
    .describe(
      "Full policy schema ID (e.g., chrome.users.IncognitoModeAvailability)"
    ),
  targetResource: z
    .string()
    .describe("Target org unit resource (e.g., orgunits/03ph8a2z1en...)"),
  value: z.record(z.string(), z.unknown()).describe("Policy value to apply"),
});

/**
 * Schema for creating a DLP rule.
 * Uses Cloud Identity API to create data protection rules.
 */
export const CreateDLPRuleSchema = z.object({
  displayName: z.string().describe("Human-readable name for the rule"),
  targetOrgUnit: z.string().describe("Org Unit ID to apply the rule to"),
  triggers: z
    .array(z.enum(["UPLOAD", "DOWNLOAD", "PRINT", "CLIPBOARD"]))
    .describe("Actions that trigger this rule"),
  action: z
    .enum(["AUDIT", "WARN", "BLOCK"])
    .default("AUDIT")
    .describe("Action to take when rule is triggered"),
});

/**
 * Inputs for the fleet overview tool.
 */
export const GetFleetOverviewSchema = z.object({
  maxEvents: z
    .number()
    .optional()
    .describe("Max number of recent Chrome events to analyze (default 50)"),
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

interface FleetKnowledgeContext {
  docs: VectorSearchResult | null;
  policies: VectorSearchResult | null;
}

interface FleetOverviewFacts {
  eventCount: number;
  blockedEventCount: number;
  errorEventCount: number;
  dlpRuleCount: number;
  connectorPolicyCount: number;
  latestEventAt: string | null;
  eventWindowLabel: string;
  eventSampled: boolean;
  eventSampleCount: number;
  errors: string[];
}

type ResolvedPolicy =
  chromepolicy_v1.Schema$GoogleChromePolicyVersionsV1ResolvedPolicy & {
    policyTargetKey?: { targetResource?: string };
  };

interface OrgUnit {
  orgUnitId?: string | null;
  parentOrgUnitId?: string | null;
  orgUnitPath?: string | null;
}

/**
 * Standardized API error response with reauth detection.
 */
interface ApiErrorResult {
  error: string;
  suggestion: string;
  requiresReauth: boolean;
}

/**
 * Context for API operations, used for error messages.
 */
interface ApiContext {
  name: string;
  defaultSuggestion: string;
}

/**
 * Registry of API contexts with their default error suggestions.
 */
const API_CONTEXTS = {
  "chrome-events": {
    name: "Chrome Events",
    defaultSuggestion:
      "Ensure the 'Admin SDK' API is enabled in GCP and the user has 'Reports' privileges.",
  },
  "dlp-rules": {
    name: "DLP Rules",
    defaultSuggestion:
      "Check 'Cloud Identity API' enablement and DLP Read permissions.",
  },
  "org-units": {
    name: "Org Units",
    defaultSuggestion:
      "Check 'Admin SDK' enablement and Org Unit Read permissions.",
  },
  "enroll-browser": {
    name: "Browser Enrollment",
    defaultSuggestion:
      "Ensure 'Chrome Browser Cloud Management API' is enabled and caller has Chrome policy admin rights.",
  },
  "connector-config": {
    name: "Connector Config",
    defaultSuggestion:
      "Check Chrome Policy API permissions and policy schema access.",
  },
} as const satisfies Record<string, ApiContext>;

type ApiContextKey = keyof typeof API_CONTEXTS;

const SESSION_EXPIRED_SUGGESTION =
  "Your session has expired. Please sign in again to continue.";

/**
 * Check if an error requires re-authentication based on HTTP status code.
 *
 * Only checks HTTP status codes (401, 403) - no brittle string matching.
 * Note: google-auth-library already auto-retries on 401/403 with token refresh.
 * If the error reaches application code, token refresh has already failed.
 */
function requiresReauthentication(code: number | string | undefined): boolean {
  const numericCode =
    typeof code === "string" ? Number.parseInt(code, 10) : code;
  return (
    numericCode === StatusCodes.UNAUTHORIZED ||
    numericCode === StatusCodes.FORBIDDEN
  );
}

/**
 * Create a standardized API error response.
 */
function createApiError(
  error: unknown,
  contextKey: ApiContextKey
): ApiErrorResult {
  const { code, message } = getErrorDetails(error);
  const context = API_CONTEXTS[contextKey];
  const requiresReauth = requiresReauthentication(code);

  return {
    error: message ?? "Unknown error",
    suggestion: requiresReauth
      ? SESSION_EXPIRED_SUGGESTION
      : context.defaultSuggestion,
    requiresReauth,
  };
}

function normalizeResource(value: string): string {
  const trimmed = value.trim();
  const stripped = trimmed.replace(/^id:/, "");
  return stripped.replaceAll(/\/{2,}/g, "/");
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
 * Format a Cloud Identity setting type into a human-readable name.
 * Example: "settings/security.password" -> "Security: Password"
 */
function formatSettingType(settingType: string): string {
  if (!settingType) {
    return "";
  }

  // Remove "settings/" prefix
  const withoutPrefix = settingType.replace(/^settings\//, "");

  // Split on dots and underscores, capitalize each part
  const parts = withoutPrefix.split(/[._]/);

  if (parts.length === 0) {
    return withoutPrefix;
  }

  // First part is the category, rest is the setting name
  const category = parts[0] ?? "";
  const settingParts = parts.slice(1);

  const capitalizedCategory =
    category.charAt(0).toUpperCase() + category.slice(1);

  if (settingParts.length === 0) {
    return capitalizedCategory;
  }

  const settingName = settingParts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");

  return `${capitalizedCategory}: ${settingName}`;
}

/**
 * Format a Cloud Identity setting value into a readable summary.
 */
function formatSettingValue(value: Record<string, unknown>): string {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return "";
  }

  // For small objects, show key=value pairs
  if (entries.length <= 3) {
    return entries
      .map(([k, v]) => {
        let formattedValue: string;
        if (typeof v === "boolean") {
          formattedValue = v ? "enabled" : "disabled";
        } else {
          formattedValue = String(v);
        }
        return `${k}: ${formattedValue}`;
      })
      .join(", ");
  }

  // For larger objects, show count of configured fields
  return `${entries.length} settings configured`;
}

/**
 * Extract deterministic fleet signals from tool outputs.
 */
function extractFleetOverviewFacts(
  eventsResult: {
    events: Awaited<ReturnType<CepToolExecutor["getChromeEvents"]>>;
    totalCount: number;
    sampled: boolean;
    windowStart: Date;
    windowEnd: Date;
  },
  dlpResult: Awaited<ReturnType<CepToolExecutor["listDLPRules"]>>,
  connectorResult: Awaited<
    ReturnType<CepToolExecutor["getChromeConnectorConfiguration"]>
  >
): FleetOverviewFacts {
  const events =
    "events" in eventsResult.events ? (eventsResult.events.events ?? []) : [];
  const rules = "rules" in dlpResult ? (dlpResult.rules ?? []) : [];
  const connectorValue =
    "value" in connectorResult ? (connectorResult.value ?? []) : [];

  const errors: string[] = [];
  if (
    "error" in eventsResult.events &&
    typeof eventsResult.events.error === "string" &&
    eventsResult.events.error.length > 0
  ) {
    errors.push(`Chrome events: ${eventsResult.events.error}`);
  }
  if (
    "error" in dlpResult &&
    typeof dlpResult.error === "string" &&
    dlpResult.error.length > 0
  ) {
    errors.push(`DLP rules: ${dlpResult.error}`);
  }
  if (
    "error" in connectorResult &&
    typeof connectorResult.error === "string" &&
    connectorResult.error.length > 0
  ) {
    errors.push(`Connector policies: ${connectorResult.error}`);
  }

  const latestEventAt =
    events.length > 0 ? (events[0]?.id?.time ?? null) : null;

  const windowDays = Math.max(
    1,
    Math.round(
      (eventsResult.windowEnd.getTime() - eventsResult.windowStart.getTime()) /
        86_400_000
    )
  );
  const eventWindowLabel = `${windowDays} day${windowDays === 1 ? "" : "s"}`;

  const blockedResults = new Set(["BLOCKED", "DENIED", "QUARANTINED"]);
  let blockedEventCount = 0;
  let errorEventCount = 0;

  for (const event of events) {
    const primary = event.events?.[0];
    const resultParam = primary?.parameters?.find(
      (param) => param.name === "EVENT_RESULT"
    );
    const resultValue =
      typeof resultParam?.value === "string" ? resultParam.value : null;
    if (resultValue && blockedResults.has(resultValue.toUpperCase())) {
      blockedEventCount += 1;
    }
    if (primary?.type) {
      const type = primary.type.toUpperCase();
      if (
        [
          "FAILURE",
          "ERROR",
          "BREACH",
          "MALWARE",
          "BLOCKED",
          "DENIED",
          "VIOLATION",
        ].some((pattern) => type.includes(pattern))
      ) {
        errorEventCount += 1;
      }
    }
  }

  return {
    eventCount: eventsResult.totalCount,
    blockedEventCount,
    errorEventCount,
    dlpRuleCount: rules.length,
    connectorPolicyCount: connectorValue.length,
    latestEventAt,
    eventWindowLabel,
    eventSampled: eventsResult.sampled,
    eventSampleCount: events.length,
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
  const result = await generateText({
    model: googleModel("gemini-2.0-flash-001"),
    output: Output.object({ schema: FleetOverviewResponseSchema }),
    system: `You are the Chrome Enterprise Premium assistant (CEP assistant) - a knowledgeable Chrome Enterprise Premium expert who helps IT admins secure and manage their browser fleet. You're direct, helpful, and focused on actionable insights. Write like a human in a chat: smooth, conversational, and concise. Never be generic, robotic, or listy.`,
    prompt: `Analyze this Chrome Enterprise fleet data and generate a compelling overview.

## Fleet Facts
${JSON.stringify(facts, null, 2)}

## Raw API Data
${JSON.stringify(context, null, 2)}

## Knowledge Context
${JSON.stringify(knowledge, null, 2)}

## Output Requirements

### Headline
Write a single welcoming sentence as a light check-in. Keep it under 15 words. Do NOT include emails, domains, or URLs. Keep it calm, high-level, and non-alarmist. Avoid diagnostic or problem-focused language in the headline. Examples:
- "Welcome back. Here's a quick fleet check-in."
- "You're set to review a few key fleet highlights."
Avoid overly generic headlines; focus on what's most actionable or notable.

### Summary
Write 2-3 sentences as a single paragraph. Make it conversational and actionable, not choppy. Avoid colons, parentheses, and bullet-like phrasing. Use natural language that explains what matters and what the admin can do next (e.g., "I can help you set up connector policies" or "We can review recent DLP activity"). Keep it calm and helpful, avoid dense statistics, and do NOT include emails, domains, or URLs.
If \`eventSampled\` is true, do NOT claim a full total; describe it as a sample.

### Posture Cards (generate 3-5 cards, prioritized by importance)
Each card should represent a meaningful security or compliance metric:

1. **DLP Coverage** - Are DLP rules configured? How many? Status: healthy if >0 rules, warning if 0.
2. **Event Monitoring** - Are Chrome events being captured? Status based on event count and recency. Use \`eventWindowLabel\`, \`eventCount\`, \`blockedEventCount\`, and \`eventSampled\` to make the value meaningful.
3. **Connector Policies** - Are data connectors configured? Status: critical if 0, healthy if configured.
4. **Browser Security** - Cookie encryption, incognito mode, Safe Browsing status (infer from connector policies if available).

For each card:
- \`label\`: Clear, human name (e.g., "Data Protection Rules", "Security Events", "Connector Status")
- \`value\`: The metric (e.g., "50 rules", "Last 6h: 42 events (5 blocked)", "Last 15 days: 120+ events (sampled)", "Not configured")
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
Do NOT include emails, domains, or URLs in suggestions.

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

  return result.output;
}

export class CepToolExecutor {
  private auth: OAuth2Client;
  private customerId: string;

  /**
   * Initialize the executor with a signed-in user's access token.
   */
  constructor(accessToken: string, customerId = "my_customer") {
    this.customerId = customerId;

    const client = new OAuth2Client();
    client.setCredentials({ access_token: accessToken });
    this.auth = client;
  }

  private async getChromeEventsWindowSummary({
    windowDays,
    pageSize = 1000,
    maxPages = 10,
    sampleSize = 50,
  }: {
    windowDays: number;
    pageSize?: number;
    maxPages?: number;
    sampleSize?: number;
  }) {
    const windowEnd = new Date();
    const windowStart = new Date(windowEnd.getTime() - windowDays * 86_400_000);

    const dayBuckets = Array.from({ length: windowDays }, (_, index) => {
      const dayEnd = new Date(windowEnd.getTime() - index * 86_400_000);
      const dayStart = new Date(dayEnd.getTime() - 86_400_000);
      return { dayStart, dayEnd };
    }).toSorted((a, b) => a.dayStart.getTime() - b.dayStart.getTime());

    let totalCount = 0;
    let sampled = false;
    let sampleEvents: Awaited<ReturnType<CepToolExecutor["getChromeEvents"]>> =
      { events: [], nextPageToken: null };

    const dayResults = await Promise.all(
      dayBuckets.map(async ({ dayStart, dayEnd }) => {
        let pageToken: string | undefined;
        let dayCount = 0;
        let daySampled = false;
        const dayStartIso = dayStart.toISOString();
        const dayEndIso = dayEnd.toISOString();

        for (let page = 0; page < maxPages; page += 1) {
          const result = await this.getChromeEvents({
            maxResults: pageSize,
            pageToken,
            startTime: dayStartIso,
            endTime: dayEndIso,
          });

          if ("error" in result) {
            return { error: result, dayCount: 0, daySampled: false };
          }

          const items = result.events ?? [];
          dayCount += items.length;

          if (
            "events" in sampleEvents &&
            sampleEvents.events.length < sampleSize
          ) {
            const remaining = sampleSize - sampleEvents.events.length;
            sampleEvents = {
              events: [...sampleEvents.events, ...items.slice(0, remaining)],
              nextPageToken: result.nextPageToken ?? null,
            };
          }

          if (!result.nextPageToken) {
            pageToken = undefined;
            break;
          }

          pageToken = result.nextPageToken ?? undefined;
        }

        if (pageToken) {
          daySampled = true;
        }

        return { dayCount, daySampled };
      })
    );

    for (const result of dayResults) {
      if ("error" in result) {
        return {
          events: result.error as Awaited<
            ReturnType<CepToolExecutor["getChromeEvents"]>
          >,
          totalCount: 0,
          sampled: false,
          windowStart,
          windowEnd,
        };
      }

      totalCount += result.dayCount;
      if (result.daySampled) {
        sampled = true;
      }
    }

    return {
      events: sampleEvents,
      totalCount,
      sampled,
      windowStart,
      windowEnd,
    };
  }

  /**
   * Fetch recent Chrome audit events from the Admin SDK Reports API.
   */
  async getChromeEvents({
    maxResults = 50,
    startTime,
    endTime,
    pageToken,
  }: z.infer<typeof GetChromeEventsSchema>) {
    console.log("[chrome-events] request", {
      maxResults,
      pageToken,
      startTime,
      endTime,
    });

    const service = googleApis.admin({
      version: "reports_v1",
      auth: this.auth,
    });
    try {
      const res = await service.activities.list({
        userKey: "all",
        applicationName: "chrome",
        maxResults,
        customerId: this.customerId,
        pageToken,
        startTime,
        endTime,
      });
      console.log(
        "[chrome-events] response",
        JSON.stringify({
          count: res.data.items?.length ?? 0,
          sample: res.data.items?.[0]?.id,
          nextPageToken: res.data.nextPageToken ?? null,
        })
      );

      return {
        events: res.data.items ?? [],
        nextPageToken: res.data.nextPageToken ?? null,
      };
    } catch (error: unknown) {
      const { code, message, errors } = getErrorDetails(error);
      console.log(
        "[chrome-events] error",
        JSON.stringify({ code, message, errors })
      );

      return createApiError(error, "chrome-events");
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

      interface CloudIdentityPolicy {
        name?: string | null;
        customer?: string | null;
        type?: string | null;
        policyQuery?: {
          query?: string | null;
          orgUnit?: string | null;
          sortOrder?: number | null;
        } | null;
        setting?: {
          type?: string | null;
          value?: Record<string, unknown> | null;
        } | null;
      }

      const rules = (res.data.policies ?? []).map(
        (policy: CloudIdentityPolicy, idx: number) => {
          const resourceName = policy.name ?? "";
          const id = resourceName.split("/").pop() ?? `rule-${idx + 1}`;

          const settingType = policy.setting?.type ?? "";
          const displayName =
            formatSettingType(settingType) || `Policy ${idx + 1}`;

          const settingValue = policy.setting?.value;
          const description = settingValue
            ? formatSettingValue(settingValue)
            : "";

          const orgUnit = policy.policyQuery?.orgUnit ?? "";
          const policyType = policy.type ?? "UNKNOWN";

          return {
            id,
            displayName,
            description,
            settingType,
            orgUnit,
            policyType,
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

      return createApiError(error, "dlp-rules");
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

      return createApiError(error, "org-units");
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

      return createApiError(error, "enroll-browser");
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
        } catch (error) {
          console.log(
            "[connector-config] explicit root-ou fetch failed",
            getErrorMessage(error)
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

      const resolveErrors: { targetResource: string; message: string }[] = [];
      for (const targetResource of targetCandidates) {
        attemptedTargets.push(targetResource);

        // The resolve endpoint only supports 'orgunits' or 'groups'.
        if (targetResource.startsWith("customers/")) {
          continue;
        }

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
              sampleTargetResource: getPolicyTargetResource(
                res.data.resolvedPolicies?.[0]
              ),
            })
          );

          resolvedPolicies.push(...(res.data.resolvedPolicies ?? []));

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

          if (!isIgnorable) {
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

      return {
        ...createApiError(error, "connector-config"),
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
    const token = await this.auth.getAccessToken();
    const accessToken = token?.token;

    if (!accessToken) {
      return { error: "No access token available in client" };
    }

    try {
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

      if (!res.ok || data.error) {
        return { error: data.error ?? `tokeninfo ${res.status}` };
      }

      return {
        scope: data.scope ?? "",
        expiresIn: data.expires_in,
        issuedTo: data.issued_to ?? data.audience,
      };
    } catch (error) {
      return { error: getErrorMessage(error) };
    }
  }

  /**
   * Draft a policy change for user review.
   * This does NOT execute changes - it returns a structured proposal
   * that the UI renders as a confirmation card for the user to approve.
   */
  // eslint-disable-next-line class-methods-use-this
  draftPolicyChange(args: z.infer<typeof DraftPolicyChangeSchema>) {
    const proposalId = `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return {
      _type: "ui.confirmation" as const,
      proposalId,
      title: `Proposed Change: ${args.policyName}`,
      description: args.reasoning,
      diff: args.proposedValue,
      target: args.targetUnit,
      adminConsoleUrl:
        args.adminConsoleUrl ?? "https://admin.google.com/ac/chrome/settings",
      intent: "update_policy",
      status: "pending_approval",
      applyParams: {
        policySchemaId: args.policyName,
        targetResource: args.targetUnit,
        value: args.proposedValue,
      },
    };
  }

  /**
   * Apply a policy change after user confirmation.
   * Uses Chrome Policy API batchModify to execute the change.
   */
  async applyPolicyChange(args: z.infer<typeof ApplyPolicyChangeSchema>) {
    const service = googleApis.chromepolicy({
      version: "v1",
      auth: this.auth,
    });

    const targetResource = buildOrgUnitTargetResource(args.targetResource);

    console.log("[apply-policy-change] request", {
      policySchemaId: args.policySchemaId,
      targetResource,
      value: args.value,
    });

    try {
      const res = await service.customers.policies.orgunits.batchModify({
        customer: `customers/${this.customerId}`,
        requestBody: {
          requests: [
            {
              policyTargetKey: {
                targetResource,
              },
              policyValue: {
                policySchema: args.policySchemaId,
                value: args.value,
              },
              updateMask: "*",
            },
          ],
        },
      });

      console.log(
        "[apply-policy-change] response",
        JSON.stringify({ status: res.status })
      );

      return {
        _type: "ui.success" as const,
        message: `Policy ${args.policySchemaId} applied successfully`,
        policySchemaId: args.policySchemaId,
        targetResource,
        appliedValue: args.value,
      };
    } catch (error: unknown) {
      const { code, message, errors } = getErrorDetails(error);
      console.log(
        "[apply-policy-change] error",
        JSON.stringify({ code, message, errors })
      );

      return {
        _type: "ui.error" as const,
        error: message ?? "Failed to apply policy change",
        suggestion:
          "Verify you have Chrome policy admin rights and the policy schema ID is correct.",
        policySchemaId: args.policySchemaId,
        targetResource,
      };
    }
  }

  /**
   * Create a DLP rule using Cloud Identity API.
   */
  /**
   * Create a DLP rule using the Cloud Identity Policy API v1beta1.
   * Requires scope: https://www.googleapis.com/auth/cloud-identity.policies
   */
  async createDLPRule(args: z.infer<typeof CreateDLPRuleSchema>) {
    console.log("[create-dlp-rule] request", {
      displayName: args.displayName,
      targetOrgUnit: args.targetOrgUnit,
      triggers: args.triggers,
      action: args.action,
    });

    const token = await this.auth.getAccessToken();
    const accessToken = token?.token;

    if (!accessToken) {
      return {
        _type: "ui.error" as const,
        message: "No access token available",
        error: "Authentication required",
        displayName: args.displayName,
        targetOrgUnit: args.targetOrgUnit,
        triggers: args.triggers,
        action: args.action,
        consoleUrl: "https://admin.google.com/ac/chrome/dlp",
      };
    }

    const triggerConditions = args.triggers.map((trigger) => {
      switch (trigger) {
        case "UPLOAD": {
          return "chrome.file_upload";
        }
        case "DOWNLOAD": {
          return "chrome.file_download";
        }
        case "PRINT": {
          return "chrome.print";
        }
        case "CLIPBOARD": {
          return "chrome.clipboard";
        }
        default: {
          throw new Error(`Unexpected trigger type: ${trigger as string}`);
        }
      }
    });

    const actionMapping: Record<string, string> = {
      AUDIT: "AUDIT_ONLY",
      WARN: "WARN_USER",
      BLOCK: "BLOCK_CONTENT",
    };

    // Build the policy payload for Cloud Identity Policy API v1beta1
    const policyPayload = {
      customer: `customers/${this.customerId}`,
      policyQuery: {
        orgUnit: buildOrgUnitTargetResource(args.targetOrgUnit),
        query: "user.is_member_of_any()",
      },
      setting: {
        type: "rule.dlp",
        value: {
          name: args.displayName,
          description: `DLP rule created via CEP Hero: ${args.displayName}`,
          triggers: triggerConditions,
          action: actionMapping[args.action] ?? "AUDIT_ONLY",
          enabled: true,
          // Match all content - a broad audit rule
          conditions: ["all_content.matches_any()"],
        },
      },
    };

    try {
      // Call Cloud Identity Policy API v1beta1 to create the policy
      const res = await fetch(
        "https://cloudidentity.googleapis.com/v1beta1/policies",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(policyPayload),
        }
      );

      const data: unknown = await res.json();

      if (!res.ok) {
        const errorData = data as { error?: { message?: string } };
        const errorMessage =
          errorData?.error?.message ?? `API error: ${res.status}`;

        console.log("[create-dlp-rule] API error", JSON.stringify(errorData));

        // If the API call fails, provide manual steps as fallback
        return {
          _type: "ui.manual_steps" as const,
          message: `API call failed: ${errorMessage}. Please create the rule manually.`,
          error: errorMessage,
          displayName: args.displayName,
          targetOrgUnit: args.targetOrgUnit,
          triggers: args.triggers,
          action: args.action,
          consoleUrl: "https://admin.google.com/ac/chrome/dlp",
          steps: [
            "1. Go to Admin Console > Security > Access and data control > Data protection",
            "2. Click 'Manage Rules' then 'Add rule' > 'New rule'",
            `3. Name the rule: ${args.displayName}`,
            `4. Set scope to org unit: ${args.targetOrgUnit}`,
            `5. Add Chrome triggers: ${args.triggers.join(", ")}`,
            `6. Set action to: ${args.action}`,
            "7. Save and enable the rule",
          ],
        };
      }

      const responseData = data as { name?: string };
      console.log(
        "[create-dlp-rule] success",
        JSON.stringify({ name: responseData.name })
      );

      return {
        _type: "ui.success" as const,
        message: `DLP rule "${args.displayName}" created successfully!`,
        ruleName: responseData.name ?? args.displayName,
        displayName: args.displayName,
        targetOrgUnit: args.targetOrgUnit,
        triggers: args.triggers,
        action: args.action,
        consoleUrl: "https://admin.google.com/ac/chrome/dlp",
      };
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      console.log("[create-dlp-rule] error", JSON.stringify({ message }));

      return {
        _type: "ui.manual_steps" as const,
        message: `Unable to create DLP rule: ${message}. Please create it manually.`,
        error: message,
        displayName: args.displayName,
        targetOrgUnit: args.targetOrgUnit,
        triggers: args.triggers,
        action: args.action,
        consoleUrl: "https://admin.google.com/ac/chrome/dlp",
        steps: [
          "1. Go to Admin Console > Security > Access and data control > Data protection",
          "2. Click 'Manage Rules' then 'Add rule' > 'New rule'",
          `3. Name the rule: ${args.displayName}`,
          `4. Set scope to org unit: ${args.targetOrgUnit}`,
          `5. Add Chrome triggers: ${args.triggers.join(", ")}`,
          `6. Set action to: ${args.action}`,
          "7. Save and enable the rule",
        ],
      };
    }
  }

  /**
   * Fetch related documentation for grounding overview responses.
   */
  // eslint-disable-next-line class-methods-use-this
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
    maxEvents = 50,
    knowledgeQuery,
  }: z.infer<typeof GetFleetOverviewSchema>) {
    const eventsWindowSummary = await this.getChromeEventsWindowSummary({
      windowDays: 7,
      pageSize: 1000,
      maxPages: 10,
      sampleSize: maxEvents,
    });

    const [dlpResult, connectorResult] = await Promise.all([
      this.listDLPRules(),
      this.getChromeConnectorConfiguration(),
    ]);

    const dataPayload = {
      eventsResult: eventsWindowSummary.events,
      eventsWindow: {
        totalCount: eventsWindowSummary.totalCount,
        sampled: eventsWindowSummary.sampled,
        windowStart: eventsWindowSummary.windowStart.toISOString(),
        windowEnd: eventsWindowSummary.windowEnd.toISOString(),
      },
      dlpResult,
      connectorResult,
    };

    const facts = extractFleetOverviewFacts(
      eventsWindowSummary,
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
      const eventSampleNote = facts.eventSampled ? " (sampled)" : "";
      const eventCountLabel = facts.eventSampled
        ? `${facts.eventCount}+ events${eventSampleNote}`
        : `${facts.eventCount} events`;

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

      let headline = "Welcome back — here’s a quick fleet check-in.";
      if (!hasDlpRules || !hasConnectors) {
        headline =
          missingItems.length === 2
            ? "Welcome back — a couple security gaps are worth tightening up."
            : `Welcome back — ${missingItems[0]} still need attention.`;
      }

      return {
        headline,
        summary:
          "Here’s a quick check-in based on your fleet data. I can help you address the items below.",
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
              facts.eventCount > 0
                ? `${eventCountLabel} in ${facts.eventWindowLabel}${
                    facts.blockedEventCount > 0
                      ? ` (${facts.blockedEventCount} blocked)`
                      : ""
                  }`
                : "No events",
            note: hasEvents
              ? `Recent activity across the last ${facts.eventWindowLabel}`
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

  const [firstUnit] = units;
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
