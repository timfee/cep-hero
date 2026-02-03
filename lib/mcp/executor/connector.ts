import { type OAuth2Client } from "google-auth-library";
import { google as googleApis, type chromepolicy_v1 } from "googleapis";

import {
  createApiError,
  getErrorDetails,
  getErrorMessage,
} from "@/lib/mcp/errors";
import { normalizeResource } from "@/lib/mcp/org-units";

import { type OrgUnitContext } from "./context";
import { buildOrgUnitTargetResource, resolveOrgUnitCandidates } from "./utils";

type ResolvedPolicy =
  chromepolicy_v1.Schema$GoogleChromePolicyVersionsV1ResolvedPolicy & {
    policyTargetKey?: { targetResource?: string };
  };

const CONNECTOR_POLICY_SCHEMAS = [
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

interface ConnectorConfigSuccess {
  status: string;
  policySchemas: string[];
  value: ResolvedPolicy[];
  targetResource?: string;
  targetResourceName?: string | null;
  attemptedTargets: string[];
  errors?: { targetResource: string; message: string }[];
}

interface ConnectorConfigError {
  error: string;
  suggestion: string;
  requiresReauth: boolean;
  policySchemas?: string[];
  targetResource?: string;
  targetResourceName?: string | null;
  attemptedTargets?: string[];
  detail?: string;
}

export type ConnectorConfigResult =
  | ConnectorConfigSuccess
  | ConnectorConfigError;

/**
 * Retrieve Chrome Connector configuration policies.
 */
export async function getChromeConnectorConfiguration(
  auth: OAuth2Client,
  customerId: string,
  orgUnitContext: OrgUnitContext
): Promise<ConnectorConfigResult> {
  const service = googleApis.chromepolicy({ version: "v1", auth });
  const { orgUnitNameMap, rootOrgUnitId } = orgUnitContext;

  const targetCandidates = buildTargetCandidates(orgUnitContext);
  if (targetCandidates.length === 0) {
    return buildNoTargetsError(orgUnitContext.error);
  }

  const attemptedTargets: string[] = [];

  try {
    return await resolveConnectorPolicies(
      service,
      customerId,
      targetCandidates,
      attemptedTargets,
      orgUnitNameMap,
      rootOrgUnitId
    );
  } catch (error: unknown) {
    return buildCatchError(error, attemptedTargets, orgUnitNameMap);
  }
}

function buildTargetCandidates(ctx: OrgUnitContext): string[] {
  const orgUnitIds = resolveOrgUnitCandidates(ctx.orgUnitList);

  if (ctx.rootOrgUnitId !== null) {
    const normalizedRoot = normalizeResource(ctx.rootOrgUnitId);
    if (!orgUnitIds.includes(normalizedRoot)) {
      orgUnitIds.unshift(normalizedRoot);
    }
  }

  return orgUnitIds
    .map((id) => buildOrgUnitTargetResource(id))
    .filter((t) => t !== "");
}

function buildNoTargetsError(contextError?: string): ConnectorConfigError {
  return {
    error: "Could not determine policy target (root org unit).",
    detail:
      contextError ??
      "No organization units were returned; ensure the token can read org units.",
    suggestion:
      "Re-authenticate with https://www.googleapis.com/auth/admin.directory.orgunit scope and retry.",
    requiresReauth: false,
    policySchemas: CONNECTOR_POLICY_SCHEMAS,
  };
}

async function resolveConnectorPolicies(
  service: ReturnType<typeof googleApis.chromepolicy>,
  customerId: string,
  targetCandidates: string[],
  attemptedTargets: string[],
  orgUnitNameMap: Map<string, string>,
  _rootOrgUnitId: string | null
): Promise<ConnectorConfigResult> {
  const resolvedPolicies: ResolvedPolicy[] = [];
  const resolveErrors: { targetResource: string; message: string }[] = [];

  for (const targetResource of targetCandidates) {
    attemptedTargets.push(targetResource);

    if (targetResource.startsWith("customers/")) {
      continue;
    }

    const result = await tryResolveTarget(
      service,
      customerId,
      targetResource,
      resolvedPolicies,
      orgUnitNameMap,
      attemptedTargets
    );

    if (result !== null) {
      return result;
    }
  }

  return buildFinalResult(
    resolvedPolicies,
    resolveErrors,
    attemptedTargets,
    orgUnitNameMap
  );
}

async function tryResolveTarget(
  service: ReturnType<typeof googleApis.chromepolicy>,
  customerId: string,
  targetResource: string,
  resolvedPolicies: ResolvedPolicy[],
  orgUnitNameMap: Map<string, string>,
  attemptedTargets: string[]
): Promise<ConnectorConfigResult | null> {
  try {
    const res = await service.customers.policies.resolve({
      customer: `customers/${customerId}`,
      requestBody: {
        policySchemaFilter: CONNECTOR_POLICY_SCHEMAS.join(","),
        pageSize: 100,
        policyTargetKey: { targetResource },
      },
    });

    logResolveResponse(targetResource, res.data.resolvedPolicies);
    resolvedPolicies.push(...(res.data.resolvedPolicies ?? []));

    return {
      status: "Resolved",
      policySchemas: CONNECTOR_POLICY_SCHEMAS,
      value: resolvedPolicies,
      targetResource,
      targetResourceName: orgUnitNameMap.get(targetResource) ?? null,
      attemptedTargets,
    };
  } catch (error) {
    const message = getErrorMessage(error);
    const isIgnorable = isIgnorableError(message);
    if (!isIgnorable) {
      console.log(
        "[connector-config] resolve error",
        JSON.stringify({ targetResource, message })
      );
    }
    return null;
  }
}

function logResolveResponse(
  targetResource: string,
  policies: ResolvedPolicy[] | undefined
): void {
  const sampleTarget = policies?.[0]?.policyTargetKey?.targetResource;
  console.log(
    "[connector-config] response",
    JSON.stringify({
      targetResource,
      count: policies?.length ?? 0,
      sampleTargetResource: sampleTarget,
    })
  );
}

function isIgnorableError(message: string): boolean {
  return (
    message.includes("Requested entity was not found") ||
    message.includes("must be of type 'orgunits' or 'groups'")
  );
}

function buildFinalResult(
  resolvedPolicies: ResolvedPolicy[],
  resolveErrors: { targetResource: string; message: string }[],
  attemptedTargets: string[],
  orgUnitNameMap: Map<string, string>
): ConnectorConfigSuccess {
  const [fallbackTarget] = attemptedTargets;
  const targetResourceName = fallbackTarget
    ? (orgUnitNameMap.get(fallbackTarget) ?? null)
    : null;

  if (resolveErrors.length > 0) {
    const errorTarget = resolveErrors[0]?.targetResource;
    return {
      status: "Resolved",
      policySchemas: CONNECTOR_POLICY_SCHEMAS,
      value: [],
      errors: resolveErrors,
      targetResource: errorTarget,
      targetResourceName: errorTarget
        ? (orgUnitNameMap.get(errorTarget) ?? null)
        : null,
      attemptedTargets,
    };
  }

  return {
    status: "Resolved",
    policySchemas: CONNECTOR_POLICY_SCHEMAS,
    value: resolvedPolicies,
    targetResource: fallbackTarget,
    targetResourceName,
    attemptedTargets,
  };
}

function buildCatchError(
  error: unknown,
  attemptedTargets: string[],
  orgUnitNameMap: Map<string, string>
): ConnectorConfigError {
  const { code, message, errors } = getErrorDetails(error);
  console.log(
    "[connector-config] error",
    JSON.stringify({ code, message, errors })
  );

  const [errorTarget] = attemptedTargets;
  const apiError = createApiError(error, "connector-config");

  return {
    ...apiError,
    policySchemas: CONNECTOR_POLICY_SCHEMAS,
    targetResource: errorTarget,
    targetResourceName: errorTarget
      ? (orgUnitNameMap.get(errorTarget) ?? null)
      : null,
    attemptedTargets,
  };
}
