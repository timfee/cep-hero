/**
 * Cloud Identity DLP policy listing and formatting for Chrome Enterprise.
 */

import { type OAuth2Client } from "google-auth-library";
import { google as googleApis } from "googleapis";
import { type z } from "zod";

import { createApiError, getErrorDetails } from "@/lib/mcp/errors";
import { formatSettingType, formatSettingValue } from "@/lib/mcp/formatters";
import { resolveOrgUnitDisplay } from "@/lib/mcp/org-units";
import { type ListDLPRulesSchema } from "@/lib/mcp/schemas";
import { searchPolicies } from "@/lib/upstash/search";

import { type OrgUnitContext } from "./context";

/**
 * Arguments for listing DLP rules from Cloud Identity.
 */
export type ListDLPRulesArgs = z.infer<typeof ListDLPRulesSchema>;

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

/**
 * Result of listing DLP rules, either a list of rules or an error.
 */
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
) {
  const service = googleApis.cloudidentity({ version: "v1", auth });
  console.log("[dlp-rules] request");

  if (service.policies?.list === undefined) {
    return DLP_SERVICE_UNAVAILABLE;
  }

  try {
    const result = await fetchAndMapPolicies(
      service,
      customerId,
      orgUnitContext,
      args
    );
    return result;
  } catch (error: unknown) {
    logDlpError(error);
    return createApiError(error, "dlp-rules");
  }
}

/**
 * Pattern to match DLP rule setting types in Cloud Identity.
 * DLP rules have setting.type starting with "rule.dlp".
 */
const DLP_SETTING_TYPE_PATTERN = /^rule\.dlp/i;

/**
 * Checks if a policy is a DLP rule based on its setting type.
 */
function isDlpRule(policy: CloudIdentityPolicy) {
  const settingType = policy.setting?.type ?? "";
  return DLP_SETTING_TYPE_PATTERN.test(settingType);
}

/**
 * Fetches policies and transforms them to the output format.
 * Filters to only include actual DLP rules (setting.type matches "rule.dlp.*").
 */
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
) {
  const policiesApi = service.policies;
  if (policiesApi === undefined) {
    return { rules: [] };
  }

  const res = await policiesApi.list({
    filter: `customer == "customers/${customerId}" AND setting.type.matches("rule.dlp.*")`,
  });
  const allPolicies = res.data.policies ?? [];
  const dlpPolicies = allPolicies.filter(isDlpRule);
  logPolicyResponse(allPolicies, dlpPolicies);

  const rules = mapPoliciesToRules(dlpPolicies, orgUnitContext);
  const result = await addHelpIfRequested(rules, args.includeHelp ?? false);
  return result;
}

/**
 * Logs the API response summary for debugging, showing both raw and filtered counts.
 */
function logPolicyResponse(
  allPolicies: CloudIdentityPolicy[],
  dlpPolicies: CloudIdentityPolicy[]
) {
  console.log(
    "[dlp-rules] response",
    JSON.stringify({
      totalPolicies: allPolicies.length,
      dlpRulesCount: dlpPolicies.length,
      sample: dlpPolicies[0]?.setting?.type,
    })
  );
}

/**
 * Attaches relevant help documentation if requested.
 */
async function addHelpIfRequested(rules: DLPRule[], includeHelp: boolean) {
  if (!includeHelp || rules.length === 0) {
    return { rules };
  }
  const help = await searchPolicies("Chrome DLP rules", 4);
  return { rules, help };
}

/**
 * Logs structured error details for debugging.
 */
function logDlpError(error: unknown) {
  const { code, message, errors } = getErrorDetails(error);
  console.log("[dlp-rules] error", JSON.stringify({ code, message, errors }));
}

/**
 * Transforms Cloud Identity policies to the output rule format.
 */
function mapPoliciesToRules(
  policies: CloudIdentityPolicy[],
  orgUnitContext: OrgUnitContext
) {
  return policies.map((policy, idx) =>
    mapPolicyToRule(policy, idx, orgUnitContext)
  );
}

/**
 * Converts a single policy to the output rule format.
 */
function mapPolicyToRule(
  policy: CloudIdentityPolicy,
  idx: number,
  orgUnitContext: OrgUnitContext
) {
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

/**
 * Formats the setting value into a human-readable description.
 */
function formatSettingDescription(
  value: Record<string, unknown> | null | undefined
) {
  if (value === null || value === undefined) {
    return "";
  }
  return formatSettingValue(value);
}
