/**
 * Fixture-based tool executor for deterministic evaluation testing.
 */

import { type z } from "zod";

import { CONNECTOR_POLICY_SCHEMAS } from "@/lib/mcp/constants";
import { resolveEnrollmentToken } from "@/lib/mcp/fixture-enrollment";
import {
  buildOrgUnitNameMap,
  resolveOrgUnitDisplay,
} from "@/lib/mcp/org-units";

import {
  type ApplyPolicyChangeSchema,
  type CreateDLPRuleSchema,
  type DraftPolicyChangeSchema,
  type EnrollBrowserSchema,
  type GetChromeEventsSchema,
  type GetFleetOverviewSchema,
  type ListDLPRulesSchema,
} from "./registry";
import {
  type ApplyPolicyChangeResult,
  type ConnectorConfigResult,
  type CreateDLPRuleResult,
  type DebugAuthResult,
  type DraftPolicyChangeResult,
  type FixtureData,
  type IToolExecutor,
} from "./types";

export { loadFixtureData } from "./fixture-loader";

/**
 * Returns fixture data instead of calling real Google APIs.
 * Used for deterministic evaluation testing.
 */
export class FixtureToolExecutor implements IToolExecutor {
  private fixtures: FixtureData;

  constructor(fixtures: FixtureData) {
    this.fixtures = fixtures;
  }

  /**
   * Returns Chrome events from fixture data.
   */
  async getChromeEvents(args: z.infer<typeof GetChromeEventsSchema>) {
    if (typeof this.fixtures.errors?.chromeEvents === "string") {
      return {
        error: this.fixtures.errors.chromeEvents,
        suggestion: "This is a fixture error for testing.",
        requiresReauth: false,
      };
    }

    const items = this.fixtures.auditEvents?.items ?? [];
    const maxResults = args.maxResults ?? 50;
    return {
      events: items.slice(0, maxResults),
      nextPageToken: this.fixtures.auditEvents?.nextPageToken ?? null,
    };
  }

  /**
   * Returns DLP rules from fixture data.
   */
  async listDLPRules() {
    if (typeof this.fixtures.errors?.dlpRules === "string") {
      return {
        error: this.fixtures.errors.dlpRules,
        suggestion: "This is a fixture error for testing.",
        requiresReauth: false,
      };
    }
    return { rules: mapDlpRules(this.fixtures) };
  }

  /**
   * Returns org units from fixture data.
   */
  async listOrgUnits() {
    if (typeof this.fixtures.errors?.orgUnits === "string") {
      return {
        error: this.fixtures.errors.orgUnits,
        suggestion: "This is a fixture error for testing.",
        requiresReauth: false,
      };
    }
    return { orgUnits: this.fixtures.orgUnits ?? [] };
  }

  /**
   * Returns enrollment token from fixture data.
   */
  async enrollBrowser() {
    if (typeof this.fixtures.errors?.enrollBrowser === "string") {
      return {
        error: this.fixtures.errors.enrollBrowser,
        suggestion:
          "Ensure the caller has Chrome policy admin rights and the API is enabled.",
        requiresReauth: false,
      };
    }
    return resolveEnrollmentToken(this.fixtures.enrollmentToken);
  }

  /**
   * Returns connector configuration from fixture data.
   */
  async getChromeConnectorConfiguration() {
    if (typeof this.fixtures.errors?.connectorConfig === "string") {
      return {
        error: this.fixtures.errors.connectorConfig,
        suggestion: "This is a fixture error for testing.",
        requiresReauth: false,
        policySchemas: [],
      };
    }
    return buildConnectorConfig(this.fixtures);
  }

  /**
   * Returns mock auth debug info.
   */
  async debugAuth() {
    return buildDebugAuthResponse();
  }

  /**
   * Returns a draft policy change proposal.
   */
  async draftPolicyChange(args: z.infer<typeof DraftPolicyChangeSchema>) {
    return buildDraftPolicyResponse(args, this.fixtures);
  }

  /**
   * Returns a successful policy application result.
   */
  async applyPolicyChange(args: z.infer<typeof ApplyPolicyChangeSchema>) {
    return buildApplyPolicyResponse(args);
  }

  /**
   * Returns a successful DLP rule creation result.
   */
  async createDLPRule(args: z.infer<typeof CreateDLPRuleSchema>) {
    return buildCreateDlpResponse(args, this.fixtures);
  }

  /**
   * Returns a fleet overview summary from fixture data.
   */
  async getFleetOverview() {
    return buildFleetOverviewResponse(this.fixtures);
  }
}

/**
 * Shape of the fixture-based fleet overview response.
 */
interface FleetOverviewFixtureResponse {
  headline: string;
  summary: string;
  postureCards: {
    label: string;
    value: string;
    note: string;
    source: string;
    action: string;
    lastUpdated?: string;
  }[];
  suggestions: string[];
  sources: string[];
}

/**
 * Builds mock auth debug response.
 */
function buildDebugAuthResponse(): DebugAuthResult {
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
  args: z.infer<typeof ApplyPolicyChangeSchema>
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
    policySchemas: CONNECTOR_POLICY_SCHEMAS,
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
      policySchemaId: args.policyName,
      targetResource: args.targetUnit,
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
): FleetOverviewFixtureResponse {
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
        timestamp
      ),
      buildPostureCard(
        "DLP rules",
        dlpRuleCount,
        "Customer DLP policies",
        "Cloud Identity",
        "List active DLP rules",
        timestamp
      ),
      buildPostureCard(
        "Connector policies",
        connectorPolicyCount,
        "Connector policy resolve",
        "Chrome Policy",
        "Check connector configuration",
        timestamp
      ),
    ],
    suggestions: [
      "List active DLP rules",
      "Show recent Chrome events",
      "Check connector configuration",
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
  lastUpdated: string
) {
  return { label, value: `${value}`, note, source, action, lastUpdated };
}
