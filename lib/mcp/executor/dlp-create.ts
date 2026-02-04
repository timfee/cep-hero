/**
 * Cloud Identity DLP rule creation with fallback to manual steps.
 */

import { type OAuth2Client } from "google-auth-library";
import { z } from "zod";

import {
  buildOrgUnitTargetResource,
  resolveOrgUnitDisplay,
} from "@/lib/mcp/org-units";
import { type CreateDLPRuleSchema } from "@/lib/mcp/schemas";

import { type OrgUnitContext } from "./context";

/**
 * Arguments for creating a new DLP rule via Cloud Identity.
 */
export type CreateDLPRuleArgs = z.infer<typeof CreateDLPRuleSchema>;

/**
 * Schema for successful API responses containing a rule name.
 */
const ApiSuccessSchema = z.object({
  name: z.string().optional(),
});

/**
 * Schema for API error responses with nested error message.
 */
const ApiErrorSchema = z.object({
  error: z
    .object({
      message: z.string(),
    })
    .optional(),
});

interface CreateDLPRuleSuccess {
  _type: "ui.success";
  message: string;
  ruleName: string;
  displayName: string;
  targetOrgUnit: string;
  triggers: string[];
  action: string;
  consoleUrl: string;
}

interface CreateDLPRuleManualSteps {
  _type: "ui.manual_steps";
  message: string;
  error: string;
  displayName: string;
  targetOrgUnit: string;
  triggers: string[];
  action: string;
  consoleUrl: string;
  steps: string[];
}

interface CreateDLPRuleError {
  _type: "ui.error";
  message: string;
  error: string;
  displayName: string;
  targetOrgUnit: string;
  triggers: string[];
  action: string;
  consoleUrl: string;
}

/**
 * Result of creating a DLP rule: success, manual steps fallback, or error.
 */
export type CreateDLPRuleResult =
  | CreateDLPRuleSuccess
  | CreateDLPRuleManualSteps
  | CreateDLPRuleError;

/**
 * Creates a DLP rule using the Cloud Identity Policy API.
 */
export async function createDLPRule(
  auth: OAuth2Client,
  customerId: string,
  orgUnitContext: OrgUnitContext,
  args: CreateDLPRuleArgs
) {
  logCreateRequest(args);
  const targetOrgUnitDisplay = resolveTargetDisplay(
    args.targetOrgUnit,
    orgUnitContext
  );
  const accessToken = await getAccessToken(auth);

  if (accessToken === null) {
    return buildNoTokenError(args, targetOrgUnitDisplay);
  }

  const result = await executeCreateRule(
    accessToken,
    customerId,
    args,
    targetOrgUnitDisplay
  );
  return result;
}

/**
 * Logs the DLP rule creation request for debugging.
 */
function logCreateRequest(args: CreateDLPRuleArgs) {
  console.log("[create-dlp-rule] request", {
    displayName: args.displayName,
    targetOrgUnit: args.targetOrgUnit,
    triggers: args.triggers,
    action: args.action,
  });
}

/**
 * Extracts the access token from the OAuth client.
 */
async function getAccessToken(auth: OAuth2Client) {
  const token = await auth.getAccessToken();
  const accessToken = token?.token;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    return null;
  }
  return accessToken;
}

/**
 * Builds the payload and submits the DLP rule creation request.
 */
async function executeCreateRule(
  accessToken: string,
  customerId: string,
  args: CreateDLPRuleArgs,
  targetOrgUnitDisplay: string
) {
  const policyPayload = buildPolicyPayload(customerId, args);
  try {
    const result = await submitDLPRule(
      accessToken,
      policyPayload,
      args,
      targetOrgUnitDisplay
    );
    return result;
  } catch (error: unknown) {
    return buildCatchError(error, args, targetOrgUnitDisplay);
  }
}

/**
 * Resolves the org unit to a human-readable display name.
 */
function resolveTargetDisplay(targetOrgUnit: string, ctx: OrgUnitContext) {
  return (
    resolveOrgUnitDisplay(
      targetOrgUnit,
      ctx.orgUnitNameMap,
      ctx.rootOrgUnitId,
      ctx.rootOrgUnitPath
    ) ?? targetOrgUnit
  );
}

/**
 * Builds an error response when no access token is available.
 */
function buildNoTokenError(
  args: CreateDLPRuleArgs,
  targetOrgUnitDisplay: string
) {
  return {
    _type: "ui.error",
    message: "No access token available",
    error: "Authentication required",
    displayName: args.displayName,
    targetOrgUnit: targetOrgUnitDisplay,
    triggers: args.triggers,
    action: args.action,
    consoleUrl: "https://admin.google.com/ac/chrome/dlp",
  };
}

/**
 * Builds the Cloud Identity API request payload.
 */
function buildPolicyPayload(customerId: string, args: CreateDLPRuleArgs) {
  const triggerConditions = args.triggers.map(mapTrigger);
  const actionMapping: Record<string, string> = {
    AUDIT: "AUDIT_ONLY",
    WARN: "WARN_USER",
    BLOCK: "BLOCK_CONTENT",
  };

  return {
    customer: `customers/${customerId}`,
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
        conditions: ["all_content.matches_any()"],
      },
    },
  };
}

/**
 * Maps user-friendly trigger names to API trigger identifiers.
 */
function mapTrigger(trigger: string) {
  const mapping: Record<string, string> = {
    UPLOAD: "chrome.file_upload",
    DOWNLOAD: "chrome.file_download",
    PRINT: "chrome.print",
    CLIPBOARD: "chrome.clipboard",
  };
  const mapped = mapping[trigger];
  if (mapped === undefined) {
    throw new Error(`Unexpected trigger type: ${trigger}`);
  }
  return mapped;
}

/**
 * Submits the DLP rule to the Cloud Identity API.
 */
async function submitDLPRule(
  accessToken: string,
  payload: ReturnType<typeof buildPolicyPayload>,
  args: CreateDLPRuleArgs,
  targetOrgUnitDisplay: string
) {
  const res = await fetch(
    "https://cloudidentity.googleapis.com/v1beta1/policies",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const data: unknown = await res.json();

  if (!res.ok) {
    return buildApiError(data, args, targetOrgUnitDisplay);
  }

  const ruleName = extractRuleName(data);
  console.log("[create-dlp-rule] success", JSON.stringify({ name: ruleName }));

  return {
    _type: "ui.success",
    message: `DLP rule "${args.displayName}" created successfully!`,
    ruleName: ruleName ?? args.displayName,
    displayName: args.displayName,
    targetOrgUnit: targetOrgUnitDisplay,
    triggers: args.triggers,
    action: args.action,
    consoleUrl: "https://admin.google.com/ac/chrome/dlp",
  };
}

/**
 * Extracts the rule name from a successful API response.
 */
function extractRuleName(data: unknown) {
  const result = ApiSuccessSchema.safeParse(data);
  if (!result.success) {
    return null;
  }
  return result.data.name ?? null;
}

/**
 * Extracts the error message from an API error response.
 */
function extractApiErrorMessage(data: unknown) {
  const result = ApiErrorSchema.safeParse(data);
  if (!result.success) {
    return "Unknown API error";
  }
  return result.data.error?.message ?? "Unknown API error";
}

/**
 * Builds a manual steps response from an API error.
 */
function buildApiError(
  data: unknown,
  args: CreateDLPRuleArgs,
  targetOrgUnitDisplay: string
) {
  const errorMessage = extractApiErrorMessage(data);
  console.log("[create-dlp-rule] API error", JSON.stringify(data));
  return buildManualSteps(errorMessage, args, targetOrgUnitDisplay);
}

/**
 * Builds a manual steps response from a caught exception.
 */
function buildCatchError(
  error: unknown,
  args: CreateDLPRuleArgs,
  targetOrgUnitDisplay: string
) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.log("[create-dlp-rule] error", JSON.stringify({ message }));

  return buildManualSteps(message, args, targetOrgUnitDisplay);
}

/**
 * Builds a response with manual steps when API creation fails.
 */
function buildManualSteps(
  errorMessage: string,
  args: CreateDLPRuleArgs,
  targetOrgUnitDisplay: string
) {
  return {
    _type: "ui.manual_steps",
    message: `Unable to create DLP rule: ${errorMessage}. Please create it manually.`,
    error: errorMessage,
    displayName: args.displayName,
    targetOrgUnit: targetOrgUnitDisplay,
    triggers: args.triggers,
    action: args.action,
    consoleUrl: "https://admin.google.com/ac/chrome/dlp",
    steps: [
      "1. Go to Admin Console > Security > Access and data control > Data protection",
      "2. Click 'Manage Rules' then 'Add rule' > 'New rule'",
      `3. Name the rule: ${args.displayName}`,
      `4. Set scope to org unit: ${targetOrgUnitDisplay}`,
      `5. Add Chrome triggers: ${args.triggers.join(", ")}`,
      `6. Set action to: ${args.action}`,
      "7. Save and enable the rule",
    ],
  };
}
