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
  appliedValue: Record<string, unknown>;
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
 * Applies a confirmed policy change via the Chrome Policy API.
 */
export async function applyPolicyChange(
  auth: OAuth2Client,
  customerId: string,
  args: ApplyPolicyChangeArgs
) {
  const service = googleApis.chromepolicy({ version: "v1", auth });
  const targetResource = buildOrgUnitTargetResource(args.targetResource);

  logApiRequest("apply-policy-change", {
    policySchemaId: args.policySchemaId,
    targetResource,
    value: args.value,
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
              value: args.value,
            },
            updateMask: "*",
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
      appliedValue: args.value,
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
