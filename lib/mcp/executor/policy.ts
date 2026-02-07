/**
 * Chrome Policy API operations for drafting and applying policy changes.
 */

import { type OAuth2Client } from "google-auth-library";
import { google as googleApis } from "googleapis";
import { type z } from "zod";

import { CONNECTOR_VALUE_KEYS } from "@/lib/mcp/constants";
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
      policySchemaId: args.policySchemaId,
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
  appliedValue: Record<string, unknown>;
}

interface ApplyPolicyChangeError {
  _type: "ui.error";
  message: string;
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
 * Derive the value key from a policy schema ID.
 * "chrome.users.SafeBrowsingDeepScanningEnabled" → "safeBrowsingDeepScanningEnabled"
 */
function inferValueKey(policySchemaId: string): string {
  const name = policySchemaId.split(".").at(-1) ?? policySchemaId;
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/**
 * Normalises the value argument into a Record suitable for the Chrome Policy
 * API. Handles three cases:
 * - Record: used as-is
 * - Array: wrapped using CONNECTOR_VALUE_KEYS mapping
 * - Primitive (boolean, string, number): wrapped with key inferred from schema
 *
 * Returns null if an array is provided for an unrecognised policy schema.
 */
function normalizeValue(
  value: unknown,
  policySchemaId: string
): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (Array.isArray(value)) {
    const key = CONNECTOR_VALUE_KEYS[policySchemaId];
    if (!key) {
      return null;
    }
    return { [key]: value };
  }

  if (value === null || value === undefined) {
    return null;
  }

  return { [inferValueKey(policySchemaId)]: value };
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
      message: "Invalid target: customer-level targeting is not allowed.",
      error: "Org Unit ID is required. Cannot target a customer directly.",
      suggestion:
        "Provide a valid org unit ID (e.g., 'orgunits/03ph8a2z1...' or '/Engineering').",
      policySchemaId: args.policySchemaId,
      targetResource: args.targetResource,
    } as const;
  }

  const normalizedValue = normalizeValue(args.value, args.policySchemaId);
  if (!normalizedValue) {
    return {
      _type: "ui.error",
      message: "Unsupported value format for this policy type.",
      error:
        "Array values are only supported for known EnterpriseConnectors policies.",
      suggestion:
        "Provide the value as a JSON object with named keys, not an array.",
      policySchemaId: args.policySchemaId,
      targetResource: args.targetResource,
    } as const;
  }
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
      message: "Failed to apply policy change.",
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
