import { type OAuth2Client } from "google-auth-library";
import { google as googleApis } from "googleapis";
import { type z } from "zod";

import { createApiError, getErrorDetails } from "@/lib/mcp/errors";
import { formatSettingType, formatSettingValue } from "@/lib/mcp/formatters";
import { resolveOrgUnitDisplay } from "@/lib/mcp/org-units";
import {
  type CreateDLPRuleSchema,
  type ListDLPRulesSchema,
} from "@/lib/mcp/schemas";
import { searchPolicies } from "@/lib/upstash/search";

import { type OrgUnitContext } from "./context";
import { buildOrgUnitTargetResource } from "./utils";

export type ListDLPRulesArgs = z.infer<typeof ListDLPRulesSchema>;
export type CreateDLPRuleArgs = z.infer<typeof CreateDLPRuleSchema>;

interface DLPRule {
  id: string;
  displayName: string;
  description: string;
  settingType: string;
  orgUnit: string;
  policyType: string;
  resourceName: string;
  consoleUrl: string;
}

interface ListDLPRulesSuccess {
  rules: DLPRule[];
  help?: unknown;
}

interface ListDLPRulesError {
  error: string;
  suggestion: string;
  requiresReauth: boolean;
}

export type ListDLPRulesResult = ListDLPRulesSuccess | ListDLPRulesError;

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

const DLP_SERVICE_UNAVAILABLE: ListDLPRulesError = {
  error: "Cloud Identity policy client unavailable",
  suggestion: "Confirm Cloud Identity API is enabled for this project.",
  requiresReauth: false,
};

/**
 * Fetches DLP policies from Cloud Identity and maps them to a structured
 * format with org unit resolution and optional help documentation.
 */
export async function listDLPRules(
  auth: OAuth2Client,
  customerId: string,
  orgUnitContext: OrgUnitContext,
  args: ListDLPRulesArgs = {}
): Promise<ListDLPRulesResult> {
  const service = googleApis.cloudidentity({ version: "v1", auth });
  console.log("[dlp-rules] request");

  if (service.policies?.list === undefined) {
    return DLP_SERVICE_UNAVAILABLE;
  }

  try {
    return await fetchAndMapPolicies(service, customerId, orgUnitContext, args);
  } catch (error: unknown) {
    logDlpError(error);
    return createApiError(error, "dlp-rules");
  }
}

async function fetchAndMapPolicies(
  service: {
    policies?: {
      list: (args: {
        filter: string;
      }) => Promise<{ data: { policies?: CloudIdentityPolicy[] } }>;
    };
  },
  customerId: string,
  orgUnitContext: OrgUnitContext,
  args: ListDLPRulesArgs
): Promise<ListDLPRulesSuccess> {
  const policiesApi = service.policies;
  if (policiesApi === undefined) {
    return { rules: [] };
  }

  const res = await policiesApi.list({
    filter: `customer == "customers/${customerId}"`,
  });
  logPolicyResponse(res.data.policies);

  const rules = mapPoliciesToRules(res.data.policies ?? [], orgUnitContext);
  return addHelpIfRequested(rules, args.includeHelp ?? false);
}

function logPolicyResponse(policies: CloudIdentityPolicy[] | undefined): void {
  console.log(
    "[dlp-rules] response",
    JSON.stringify({
      count: policies?.length ?? 0,
      sample: policies?.[0]?.name,
    })
  );
}

async function addHelpIfRequested(
  rules: DLPRule[],
  includeHelp: boolean
): Promise<ListDLPRulesSuccess> {
  if (!includeHelp || rules.length === 0) {
    return { rules };
  }
  const help = await searchPolicies("Chrome DLP rules", 4);
  return { rules, help };
}

function logDlpError(error: unknown): void {
  const { code, message, errors } = getErrorDetails(error);
  console.log("[dlp-rules] error", JSON.stringify({ code, message, errors }));
}

function mapPoliciesToRules(
  policies: CloudIdentityPolicy[],
  orgUnitContext: OrgUnitContext
): DLPRule[] {
  return policies.map((policy, idx) =>
    mapPolicyToRule(policy, idx, orgUnitContext)
  );
}

function mapPolicyToRule(
  policy: CloudIdentityPolicy,
  idx: number,
  orgUnitContext: OrgUnitContext
): DLPRule {
  const { orgUnitNameMap, rootOrgUnitId, rootOrgUnitPath } = orgUnitContext;
  const resourceName = policy.name ?? "";
  const id = resourceName.split("/").pop() ?? `rule-${idx + 1}`;
  const settingType = policy.setting?.type ?? "";
  const displayName = formatSettingType(settingType) || `Policy ${idx + 1}`;
  const description = formatSettingDescription(policy.setting?.value);
  const orgUnitRaw = policy.policyQuery?.orgUnit ?? "";
  const orgUnit =
    resolveOrgUnitDisplay(
      orgUnitRaw,
      orgUnitNameMap,
      rootOrgUnitId,
      rootOrgUnitPath
    ) ?? orgUnitRaw;
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

function formatSettingDescription(
  value: Record<string, unknown> | null | undefined
): string {
  if (value === null || value === undefined) {
    return "";
  }
  return formatSettingValue(value);
}

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

export type CreateDLPRuleResult =
  | CreateDLPRuleSuccess
  | CreateDLPRuleManualSteps
  | CreateDLPRuleError;

/**
 * Create a DLP rule using the Cloud Identity Policy API.
 */
export async function createDLPRule(
  auth: OAuth2Client,
  customerId: string,
  orgUnitContext: OrgUnitContext,
  args: CreateDLPRuleArgs
): Promise<CreateDLPRuleResult> {
  console.log("[create-dlp-rule] request", {
    displayName: args.displayName,
    targetOrgUnit: args.targetOrgUnit,
    triggers: args.triggers,
    action: args.action,
  });

  const targetOrgUnitDisplay = resolveTargetDisplay(
    args.targetOrgUnit,
    orgUnitContext
  );
  const token = await auth.getAccessToken();
  const accessToken = token?.token;

  if (typeof accessToken !== "string" || accessToken.length === 0) {
    return buildNoTokenError(args, targetOrgUnitDisplay);
  }

  const policyPayload = buildPolicyPayload(customerId, args);

  try {
    return await submitDLPRule(
      accessToken,
      policyPayload,
      args,
      targetOrgUnitDisplay
    );
  } catch (error: unknown) {
    return buildCatchError(error, args, targetOrgUnitDisplay);
  }
}

function resolveTargetDisplay(
  targetOrgUnit: string,
  ctx: OrgUnitContext
): string {
  return (
    resolveOrgUnitDisplay(
      targetOrgUnit,
      ctx.orgUnitNameMap,
      ctx.rootOrgUnitId,
      ctx.rootOrgUnitPath
    ) ?? targetOrgUnit
  );
}

function buildNoTokenError(
  args: CreateDLPRuleArgs,
  targetOrgUnitDisplay: string
): CreateDLPRuleError {
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

function mapTrigger(trigger: string): string {
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

async function submitDLPRule(
  accessToken: string,
  payload: ReturnType<typeof buildPolicyPayload>,
  args: CreateDLPRuleArgs,
  targetOrgUnitDisplay: string
): Promise<CreateDLPRuleSuccess | CreateDLPRuleManualSteps> {
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

function extractRuleName(data: unknown): string | null {
  const name = getProperty(data, "name");
  return typeof name === "string" ? name : null;
}

function extractApiErrorMessage(data: unknown): string {
  const error = getProperty(data, "error");
  const message = getProperty(error, "message");
  return typeof message === "string" ? message : "Unknown API error";
}

function getProperty(obj: unknown, key: string): unknown {
  if (typeof obj !== "object" || obj === null) {
    return undefined;
  }
  if (!Object.hasOwn(obj, key)) {
    return undefined;
  }
  return Reflect.get(obj, key);
}

function buildApiError(
  data: unknown,
  args: CreateDLPRuleArgs,
  targetOrgUnitDisplay: string
): CreateDLPRuleManualSteps {
  const errorMessage = extractApiErrorMessage(data);
  console.log("[create-dlp-rule] API error", JSON.stringify(data));
  return buildManualSteps(errorMessage, args, targetOrgUnitDisplay);
}

function buildCatchError(
  error: unknown,
  args: CreateDLPRuleArgs,
  targetOrgUnitDisplay: string
): CreateDLPRuleManualSteps {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.log("[create-dlp-rule] error", JSON.stringify({ message }));

  return buildManualSteps(message, args, targetOrgUnitDisplay);
}

function buildManualSteps(
  errorMessage: string,
  args: CreateDLPRuleArgs,
  targetOrgUnitDisplay: string
): CreateDLPRuleManualSteps {
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
