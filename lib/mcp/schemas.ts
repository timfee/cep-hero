/**
 * Zod schemas for MCP tool input validation.
 */

import { z } from "zod";

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
 * Schema for listing organizational units.
 */
export const ListOrgUnitsSchema = z.object({});

/**
 * Schema for drafting a policy change for user review. This tool does NOT
 * execute changes - it returns a structured proposal for UI confirmation.
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
 * Schema for applying a policy change after user confirmation.
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
 * Schema for creating a DLP rule via Cloud Identity API.
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
 * Schema for fetching fleet overview data.
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
 * Schema for structured AI output from fleet overview summarization.
 */
export const FleetOverviewResponseSchema = z.object({
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
