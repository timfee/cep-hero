import { type z } from "zod";

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
  type ChromeEventsResult,
  type ConnectorConfigResult,
  type CreateDLPRuleResult,
  type DebugAuthResult,
  type DLPRulesResult,
  type DraftPolicyChangeResult,
  type EnrollBrowserResult,
  type FixtureData,
  type IToolExecutor,
  type OrgUnitsResult,
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

  async getChromeEvents(
    args: z.infer<typeof GetChromeEventsSchema>
  ): Promise<ChromeEventsResult> {
    if (typeof this.fixtures.errors?.chromeEvents === "string") {
      const result: ChromeEventsResult = {
        error: this.fixtures.errors.chromeEvents,
        suggestion: "This is a fixture error for testing.",
        requiresReauth: false,
      };
      return result;
    }

    const items = this.fixtures.auditEvents?.items ?? [];
    const maxResults = args.maxResults ?? 50;
    const result: ChromeEventsResult = {
      events: items.slice(0, maxResults),
      nextPageToken: this.fixtures.auditEvents?.nextPageToken ?? null,
    };
    return result;
  }

  async listDLPRules(
    _args?: z.infer<typeof ListDLPRulesSchema>
  ): Promise<DLPRulesResult> {
    if (typeof this.fixtures.errors?.dlpRules === "string") {
      const result: DLPRulesResult = {
        error: this.fixtures.errors.dlpRules,
        suggestion: "This is a fixture error for testing.",
        requiresReauth: false,
      };
      return result;
    }

    const rules = mapDlpRules(this.fixtures);
    const result: DLPRulesResult = { rules };
    return result;
  }

  async listOrgUnits(): Promise<OrgUnitsResult> {
    if (typeof this.fixtures.errors?.orgUnits === "string") {
      const result: OrgUnitsResult = {
        error: this.fixtures.errors.orgUnits,
        suggestion: "This is a fixture error for testing.",
        requiresReauth: false,
      };
      return result;
    }
    const result: OrgUnitsResult = { orgUnits: this.fixtures.orgUnits ?? [] };
    return result;
  }

  async enrollBrowser(
    _args: z.infer<typeof EnrollBrowserSchema>
  ): Promise<EnrollBrowserResult> {
    if (typeof this.fixtures.errors?.enrollBrowser === "string") {
      const result: EnrollBrowserResult = {
        error: this.fixtures.errors.enrollBrowser,
        suggestion:
          "Ensure the caller has Chrome policy admin rights and the API is enabled.",
        requiresReauth: false,
      };
      return result;
    }
    const result = resolveEnrollmentToken(this.fixtures.enrollmentToken);
    return result;
  }

  async getChromeConnectorConfiguration(): Promise<ConnectorConfigResult> {
    if (typeof this.fixtures.errors?.connectorConfig === "string") {
      const result: ConnectorConfigResult = {
        error: this.fixtures.errors.connectorConfig,
        suggestion: "This is a fixture error for testing.",
        requiresReauth: false,
        policySchemas: [],
      };
      return result;
    }
    const result = buildConnectorConfig(this.fixtures);
    return result;
  }

  async debugAuth(): Promise<DebugAuthResult> {
    const result = buildDebugAuthResponse();
    return result;
  }

  async draftPolicyChange(
    args: z.infer<typeof DraftPolicyChangeSchema>
  ): Promise<DraftPolicyChangeResult> {
    const result = buildDraftPolicyResponse(args, this.fixtures);
    return result;
  }

  async applyPolicyChange(
    args: z.infer<typeof ApplyPolicyChangeSchema>
  ): Promise<ApplyPolicyChangeResult> {
    const result = buildApplyPolicyResponse(args);
    return result;
  }

  async createDLPRule(
    args: z.infer<typeof CreateDLPRuleSchema>
  ): Promise<CreateDLPRuleResult> {
    const result = buildCreateDlpResponse(args, this.fixtures);
    return result;
  }

  async getFleetOverview(
    _args: z.infer<typeof GetFleetOverviewSchema>
  ): Promise<FleetOverviewFixtureResponse> {
    const result = buildFleetOverviewResponse(this.fixtures);
    return result;
  }
}

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

function findRootOrgUnitId(
  orgUnits: FixtureData["orgUnits"]
): string | undefined {
  const id = orgUnits?.find((unit) => unit.orgUnitPath === "/")?.orgUnitId;
  return id ?? undefined;
}

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
