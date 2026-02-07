/**
 * Fixture-based tool executor for deterministic evaluation testing.
 */

import { type z } from "zod";

import { CONNECTOR_POLICY_SCHEMAS } from "@/lib/mcp/constants";
import { resolveEnrollmentToken } from "@/lib/mcp/fixture-enrollment";
import {
  buildOrgUnitNameMap,
  resolveOrgUnitDisplay,
  resolveTargetForApply,
} from "@/lib/mcp/org-units";

import { type ConnectorConfigResult } from "./executor/connector";
import { type ListDLPRulesResult } from "./executor/dlp-list";
import { type ListOrgUnitsResult } from "./executor/org-units-api";
import {
  type ApplyPolicyChangeSchema,
  type CreateDLPRuleSchema,
  type DraftPolicyChangeSchema,
  type EnrollBrowserSchema,
  type GetChromeEventsSchema,
  type FleetOverviewResponse,
  type GetFleetOverviewSchema,
} from "./registry";
import {
  type ApplyPolicyChangeResult,
  type CreateDLPRuleResult,
  type DebugAuthResult,
  type DraftPolicyChangeResult,
  type FixtureData,
  type ToolExecutor,
} from "./types";

export { loadFixtureData } from "./fixture-loader";

/**
 * Standard fixture error response for testing.
 */
const FIXTURE_ERROR_SUGGESTION = "This is a fixture error for testing.";

/**
 * Build a fixture error response if error is configured.
 */
function buildFixtureError<T extends Record<string, unknown>>(
  error: string | undefined,
  extra?: T
): ({ error: string; suggestion: string; requiresReauth: false } & T) | null {
  if (typeof error !== "string") {
    return null;
  }
  return {
    error,
    suggestion: FIXTURE_ERROR_SUGGESTION,
    requiresReauth: false,
    ...extra,
  } as { error: string; suggestion: string; requiresReauth: false } & T;
}

/**
 * Returns fixture data instead of calling real Google APIs.
 * Used for deterministic evaluation testing.
 */
export class FixtureToolExecutor implements ToolExecutor {
  private fixtures: FixtureData;

  constructor(fixtures: FixtureData) {
    this.fixtures = fixtures;
  }

  /**
   * Returns Chrome events from fixture data.
   */
  getChromeEvents(args: z.infer<typeof GetChromeEventsSchema>) {
    const fixtureError = buildFixtureError(this.fixtures.errors?.chromeEvents);
    if (fixtureError) {
      return Promise.resolve(fixtureError);
    }

    const items = this.fixtures.auditEvents?.items ?? [];
    const maxResults = args.maxResults ?? 50;
    return Promise.resolve({
      events: items.slice(0, maxResults),
      nextPageToken: this.fixtures.auditEvents?.nextPageToken ?? null,
    });
  }

  /**
   * Returns DLP rules from fixture data.
   */
  listDLPRules(): Promise<ListDLPRulesResult> {
    const fixtureError = buildFixtureError(this.fixtures.errors?.dlpRules);
    if (fixtureError) {
      return Promise.resolve(fixtureError);
    }
    return Promise.resolve({ rules: mapDlpRules(this.fixtures) });
  }

  /**
   * Returns org units from fixture data.
   */
  listOrgUnits(): Promise<ListOrgUnitsResult> {
    const fixtureError = buildFixtureError(this.fixtures.errors?.orgUnits);
    if (fixtureError) {
      return Promise.resolve(fixtureError);
    }
    return Promise.resolve({ orgUnits: this.fixtures.orgUnits ?? [] });
  }

  /**
   * Returns enrollment token from fixture data.
   */
  enrollBrowser(_args?: z.infer<typeof EnrollBrowserSchema>) {
    if (typeof this.fixtures.errors?.enrollBrowser === "string") {
      return Promise.resolve({
        error: this.fixtures.errors.enrollBrowser,
        suggestion:
          "Ensure the caller has Chrome policy admin rights and the API is enabled.",
        requiresReauth: false,
      });
    }
    return Promise.resolve(
      resolveEnrollmentToken(this.fixtures.enrollmentToken)
    );
  }

  /**
   * Returns connector configuration from fixture data.
   */
  getChromeConnectorConfiguration() {
    const fixtureError = buildFixtureError(
      this.fixtures.errors?.connectorConfig,
      { policySchemas: [] as string[] }
    );
    if (fixtureError) {
      return Promise.resolve(fixtureError);
    }
    return Promise.resolve(buildConnectorConfig(this.fixtures));
  }

  /**
   * Returns mock auth debug info.
   * Uses fixture context for consistency with interface.
   */
  debugAuth() {
    return Promise.resolve(buildDebugAuthResponse(this.fixtures));
  }

  /**
   * Returns a draft policy change proposal.
   */
  draftPolicyChange(args: z.infer<typeof DraftPolicyChangeSchema>) {
    return Promise.resolve(buildDraftPolicyResponse(args, this.fixtures));
  }

  /**
   * Returns a successful policy application result.
   * Uses fixture context for consistency with interface.
   */
  applyPolicyChange(args: z.infer<typeof ApplyPolicyChangeSchema>) {
    return Promise.resolve(buildApplyPolicyResponse(args, this.fixtures));
  }

  /**
   * Returns a successful DLP rule creation result.
   */
  createDLPRule(args: z.infer<typeof CreateDLPRuleSchema>) {
    return Promise.resolve(buildCreateDlpResponse(args, this.fixtures));
  }

  /**
   * Returns a fleet overview summary from fixture data.
   */
  getFleetOverview(_args?: z.infer<typeof GetFleetOverviewSchema>) {
    return Promise.resolve(buildFleetOverviewResponse(this.fixtures));
  }
}

/**
 * Builds mock auth debug response.
 */
function buildDebugAuthResponse(_fixtures: FixtureData): DebugAuthResult {
  return {
    scopes: [
      "https://www.googleapis.com/auth/admin.reports.audit.readonly",
      "https://www.googleapis.com/auth/admin.directory.orgunit.readonly",
      "https://www.googleapis.com/auth/chrome.management.policy.readonly",
      "https://www.googleapis.com/auth/cloud-identity.policies.readonly",
    ],
    expiresIn: 3600,
    email: "fixture-admin@example.com",
    accessType: "offline",
  };
}

/**
 * Builds a successful policy application response.
 */
function buildApplyPolicyResponse(
  args: z.infer<typeof ApplyPolicyChangeSchema>,
  _fixtures: FixtureData
): ApplyPolicyChangeResult {
  return {
    _type: "ui.success",
    message: `Policy ${args.policySchemaId} applied successfully`,
    policySchemaId: args.policySchemaId,
    targetResource: args.targetResource,
    appliedValue: args.value,
  };
}

/**
 * Maps fixture DLP rules to the expected output format.
 */
function mapDlpRules(fixtures: FixtureData) {
  const fixtureRules = fixtures.dlpRules ?? [];
  const orgUnitNameMap = buildOrgUnitNameMap(fixtures.orgUnits ?? []);
  const rootOrgUnitId = findRootOrgUnitId(fixtures.orgUnits);

  return fixtureRules.map((rule, idx) => {
    const orgUnitValue = rule.targetResource ?? rule.orgUnit ?? "";
    return {
      id: rule.name?.split("/").pop() ?? `rule-${idx + 1}`,
      displayName: rule.displayName ?? `DLP Rule ${idx + 1}`,
      description: rule.description ?? "",
      settingType: rule.triggers?.join(", ") ?? "",
      orgUnit:
        resolveOrgUnitDisplay(
          orgUnitValue,
          orgUnitNameMap,
          rootOrgUnitId,
          "/"
        ) ?? "",
      policyType: rule.action ?? "AUDIT",
      resourceName: rule.name ?? "",
      consoleUrl: "https://admin.google.com/ac/chrome/dlp",
    };
  });
}

/**
 * Finds the root org unit ID from a list of org units.
 */
function findRootOrgUnitId(orgUnits: FixtureData["orgUnits"]) {
  return orgUnits?.find((unit) => unit.orgUnitPath === "/")?.orgUnitId;
}

/**
 * Builds connector configuration from fixture data.
 */
function buildConnectorConfig(fixtures: FixtureData): ConnectorConfigResult {
  const firstOrgUnit = fixtures.orgUnits?.[0];
  const targetResource = firstOrgUnit?.orgUnitId ?? "orgunits/root";
  const targetResourceName =
    firstOrgUnit?.orgUnitPath ?? firstOrgUnit?.name ?? null;

  return {
    status: "Resolved",
    policySchemas: [...CONNECTOR_POLICY_SCHEMAS],
    value: fixtures.connectorPolicies ?? [],
    targetResource,
    targetResourceName,
    attemptedTargets:
      fixtures.orgUnits
        ?.map((ou: { orgUnitId?: string | null }) => ou.orgUnitId ?? "")
        .filter(Boolean) ?? [],
  };
}

/**
 * Builds a draft policy change response.
 */
function buildDraftPolicyResponse(
  args: z.infer<typeof DraftPolicyChangeSchema>,
  fixtures: FixtureData
): DraftPolicyChangeResult {
  const proposalId = `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const orgUnitNameMap = buildOrgUnitNameMap(fixtures.orgUnits ?? []);
  const rootOrgUnitId = findRootOrgUnitId(fixtures.orgUnits);
  const targetDisplay =
    resolveOrgUnitDisplay(
      args.targetUnit,
      orgUnitNameMap,
      rootOrgUnitId,
      "/"
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
      targetResource: resolveTargetForApply(
        args.targetUnit,
        orgUnitNameMap,
        rootOrgUnitId
      ),
      value: args.proposedValue,
    },
  };
}

/**
 * Builds a DLP rule creation response.
 */
function buildCreateDlpResponse(
  args: z.infer<typeof CreateDLPRuleSchema>,
  fixtures: FixtureData
): CreateDLPRuleResult {
  const orgUnitNameMap = buildOrgUnitNameMap(fixtures.orgUnits ?? []);
  const rootOrgUnitId = findRootOrgUnitId(fixtures.orgUnits);
  const targetOrgUnitDisplay =
    resolveOrgUnitDisplay(
      args.targetOrgUnit,
      orgUnitNameMap,
      rootOrgUnitId,
      "/"
    ) ?? args.targetOrgUnit;

  return {
    _type: "ui.success",
    message: `DLP rule "${args.displayName}" created successfully`,
    ruleName: `policies/dlp-${Date.now()}`,
    displayName: args.displayName,
    targetOrgUnit: targetOrgUnitDisplay,
    triggers: args.triggers,
    action: args.action,
    consoleUrl: "https://admin.google.com/ac/chrome/dlp",
  };
}

/**
 * Builds a fleet overview response from fixture data.
 */
function buildFleetOverviewResponse(
  fixtures: FixtureData
): FleetOverviewResponse {
  const eventCount = fixtures.auditEvents?.items?.length ?? 0;
  const dlpRuleCount = fixtures.dlpRules?.length ?? 0;
  const connectorPolicyCount = fixtures.connectorPolicies?.length ?? 0;
  const timestamp = new Date().toISOString();

  return {
    headline: "I just reviewed your Chrome fleet.",
    summary: `Found ${eventCount} recent events, ${dlpRuleCount} DLP rules, and ${connectorPolicyCount} connector policies.`,
    postureCards: [
      buildPostureCard(
        "Recent events",
        eventCount,
        "Chrome activity logs",
        "Admin SDK Reports",
        "Show recent Chrome events",
        timestamp,
        eventCount > 10 ? "warning" : "healthy",
        1
      ),
      buildPostureCard(
        "DLP rules",
        dlpRuleCount,
        "Customer DLP policies",
        "Cloud Identity",
        "List active DLP rules",
        timestamp,
        dlpRuleCount === 0 ? "critical" : "healthy",
        2
      ),
      buildPostureCard(
        "Connector policies",
        connectorPolicyCount,
        "Connector policy resolve",
        "Chrome Policy",
        "Check connector configuration",
        timestamp,
        connectorPolicyCount === 0 ? "warning" : "healthy",
        3
      ),
    ],
    suggestions: [
      {
        text: "List active DLP rules",
        action: "List active DLP rules",
        priority: 1,
        category: "security" as const,
      },
      {
        text: "Show recent Chrome events",
        action: "Show recent Chrome events",
        priority: 2,
        category: "monitoring" as const,
      },
      {
        text: "Check connector configuration",
        action: "Check connector configuration",
        priority: 3,
        category: "compliance" as const,
      },
    ],
    sources: ["Admin SDK Reports", "Cloud Identity", "Chrome Policy"],
  };
}

/**
 * Builds a single posture card for the fleet overview.
 */
function buildPostureCard(
  label: string,
  value: number,
  note: string,
  source: string,
  action: string,
  lastUpdated: string,
  status: "healthy" | "warning" | "critical" | "info",
  priority: number
) {
  return {
    label,
    value: `${value}`,
    note,
    source,
    action,
    lastUpdated,
    status,
    priority,
  };
}
