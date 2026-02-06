/**
 * Chrome Policy API operations for drafting and applying policy changes.
 */

import { type OAuth2Client } from "google-auth-library";
import { google as googleApis } from "googleapis";
import { type z } from "zod";

import { logApiError, logApiRequest, logApiResponse } from "@/lib/mcp/errors";
import {
  buildOrgUnitTargetResource,
  resolveOrgUnitDisplay,
} from "@/lib/mcp/org-units";
import {
  type ApplyPolicyChangeSchema,
  type DraftPolicyChangeSchema,
} from "@/lib/mcp/schemas";

import { type OrgUnitContext } from "./context";

/**
 * Arguments for drafting a Chrome policy change proposal.
 */
export type DraftPolicyChangeArgs = z.infer<typeof DraftPolicyChangeSchema>;

/**
 * Arguments for applying a confirmed Chrome policy change.
 * The value field may be a record or array depending on the policy schema.
 */
export type ApplyPolicyChangeArgs = z.infer<typeof ApplyPolicyChangeSchema>;

/**
 * Result of drafting a policy change, containing the proposal for user review.
 */
export interface DraftPolicyChangeResult {
  _type: "ui.confirmation";
  proposalId: string;
  title: string;
  description: string;
  diff: unknown;
  target: string;
  adminConsoleUrl: string;
  intent: string;
  status: string;
  applyParams: {
    policySchemaId: string;
    targetResource: string;
    value: unknown;
  };
}

/**
 * Creates a policy change proposal for user review before application.
 */
export function draftPolicyChange(
  orgUnitContext: OrgUnitContext,
  args: DraftPolicyChangeArgs
) {
  const proposalId = `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { orgUnitNameMap, rootOrgUnitId, rootOrgUnitPath } = orgUnitContext;

  const targetDisplay =
    resolveOrgUnitDisplay(
      args.targetUnit,
      orgUnitNameMap,
      rootOrgUnitId,
      rootOrgUnitPath
    ) ?? args.targetUnit;

  return {
    _type: "ui.confirmation",
    proposalId,
    title: `Proposed Change: ${args.policyName}`,
    description: args.reasoning,
    diff: args.proposedValue,
    target: targetDisplay,
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

interface ApplyPolicyChangeSuccess {
  _type: "ui.success";
  message: string;
  policySchemaId: string;
  targetResource: string;
  appliedValue: Record<string, unknown> | unknown[];
}

interface ApplyPolicyChangeError {
  _type: "ui.error";
  error: string;
  suggestion: string;
  policySchemaId: string;
  targetResource: string;
}

/**
 * Result of applying a policy change, either success or error.
 */
export type ApplyPolicyChangeResult =
  | ApplyPolicyChangeSuccess
  | ApplyPolicyChangeError;

/**
 * Builds an updateMask from the value object's keys. The Chrome Policy API
 * requires explicit field names rather than a wildcard.
 */
function buildUpdateMask(value: Record<string, unknown>) {
  const keys = Object.keys(value);
  return keys.length > 0 ? keys.join(",") : "";
}

/**
 * Derives the record key name from a connector policy schema ID.
 * Example: "chrome.users.EnterpriseConnectors.OnFileAttached" → "onFileAttachedEnterpriseConnector"
 */
function connectorKeyFromSchema(schemaId: string): string {
  const leaf = schemaId.split(".").at(-1) ?? "";
  return `${leaf.charAt(0).toLowerCase()}${leaf.slice(1)}EnterpriseConnector`;
}

/**
 * Normalises the value argument into a Record suitable for the Chrome Policy
 * API. When the AI sends an array (common for connector policies), the value
 * is wrapped in a record keyed by the connector policy field name.
 */
function normalizeValue(
  value: Record<string, unknown> | unknown[],
  policySchemaId: string
): Record<string, unknown> {
  if (Array.isArray(value)) {
    const key = connectorKeyFromSchema(policySchemaId);
    return { [key]: value };
  }
  return value;
}

/**
 * Applies a confirmed policy change via the Chrome Policy API.
 */
export async function applyPolicyChange(
  auth: OAuth2Client,
  customerId: string,
  args: ApplyPolicyChangeArgs
) {
  const service = googleApis.chromepolicy({ version: "v1", auth });
  const targetResource = buildOrgUnitTargetResource(args.targetResource);

  if (!targetResource || targetResource.startsWith("customers/")) {
    return {
      _type: "ui.error",
      error: "Org Unit ID is required. Cannot target a customer directly.",
      suggestion:
        "Provide a valid org unit ID (e.g., 'orgunits/03ph8a2z1...' or '/Engineering').",
      policySchemaId: args.policySchemaId,
      targetResource: args.targetResource,
    } as const;
  }

  const normalizedValue = normalizeValue(args.value, args.policySchemaId);
  const updateMask = buildUpdateMask(normalizedValue);

  logApiRequest("apply-policy-change", {
    policySchemaId: args.policySchemaId,
    targetResource,
    value: normalizedValue,
    updateMask,
  });

  try {
    const res = await service.customers.policies.orgunits.batchModify({
      customer: `customers/${customerId}`,
      requestBody: {
        requests: [
          {
            policyTargetKey: { targetResource },
            policyValue: {
              policySchema: args.policySchemaId,
              value: normalizedValue,
            },
            updateMask,
          },
        ],
      },
    });

    logApiResponse("apply-policy-change", { status: res.status });

    return {
      _type: "ui.success",
      message: `Policy ${args.policySchemaId} applied successfully`,
      policySchemaId: args.policySchemaId,
      targetResource,
      appliedValue: normalizedValue,
    } as const;
  } catch (error: unknown) {
    logApiError("apply-policy-change", error);

    return {
      _type: "ui.error",
      error:
        error instanceof Error
          ? error.message
          : "Failed to apply policy change",
      suggestion:
        "Verify you have Chrome policy admin rights and the policy schema ID is correct.",
      policySchemaId: args.policySchemaId,
      targetResource,
    } as const;
  }
}
