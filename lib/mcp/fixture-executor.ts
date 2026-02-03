import { type z } from "zod";

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

/**
 * A tool executor that returns fixture data instead of calling real Google APIs.
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
    await Promise.resolve();
    if (typeof this.fixtures.errors?.chromeEvents === "string") {
      return {
        error: this.fixtures.errors.chromeEvents,
        suggestion: "This is a fixture error for testing.",
        requiresReauth: false,
      };
    }

    const items = this.fixtures.auditEvents?.items ?? [];
    const maxResults = args.maxResults ?? 50;
    const events = items.slice(0, maxResults);

    return {
      events,
      nextPageToken: this.fixtures.auditEvents?.nextPageToken ?? null,
    };
  }

  async listDLPRules(
    _args?: z.infer<typeof ListDLPRulesSchema>
  ): Promise<DLPRulesResult> {
    await Promise.resolve();
    if (typeof this.fixtures.errors?.dlpRules === "string") {
      return {
        error: this.fixtures.errors.dlpRules,
        suggestion: "This is a fixture error for testing.",
        requiresReauth: false,
      };
    }

    const fixtureRules = this.fixtures.dlpRules ?? [];
    const rules = fixtureRules.map((rule, idx) => ({
      id: rule.name?.split("/").pop() ?? `rule-${idx + 1}`,
      displayName: rule.displayName ?? `DLP Rule ${idx + 1}`,
      description: rule.description ?? "",
      settingType: rule.triggers?.join(", ") ?? "",
      orgUnit: "",
      policyType: rule.action ?? "AUDIT",
      resourceName: rule.name ?? "",
      consoleUrl: "https://admin.google.com/ac/chrome/dlp",
    }));

    return { rules };
  }

  async listOrgUnits(): Promise<OrgUnitsResult> {
    await Promise.resolve();
    if (typeof this.fixtures.errors?.orgUnits === "string") {
      return {
        error: this.fixtures.errors.orgUnits,
        suggestion: "This is a fixture error for testing.",
        requiresReauth: false,
      };
    }

    return {
      orgUnits: this.fixtures.orgUnits ?? [],
    };
  }

  async enrollBrowser(
    _args: z.infer<typeof EnrollBrowserSchema>
  ): Promise<EnrollBrowserResult> {
    await Promise.resolve();
    // Check for error injection
    if (typeof this.fixtures.errors?.enrollBrowser === "string") {
      return {
        error: this.fixtures.errors.enrollBrowser,
        suggestion:
          "Ensure the caller has Chrome policy admin rights and the API is enabled.",
        requiresReauth: false,
      };
    }

    // Check for custom enrollment token fixture
    if (this.fixtures.enrollmentToken !== undefined) {
      const { token, expiresAt, status, error } = this.fixtures.enrollmentToken;

      // If token has error or bad status, return error
      if (typeof error === "string") {
        return {
          error,
          suggestion: "Check enrollment token configuration.",
          requiresReauth: false,
        };
      }
      if (status === "expired") {
        return {
          error: "Enrollment token has expired",
          suggestion: "Generate a new enrollment token.",
          requiresReauth: false,
        };
      }
      if (status === "revoked") {
        return {
          error: "Enrollment token has been revoked",
          suggestion: "Generate a new enrollment token.",
          requiresReauth: false,
        };
      }

      return {
        enrollmentToken: token ?? "fixture-enrollment-token-12345",
        expiresAt: expiresAt ?? null,
      };
    }

    // Default successful response
    return {
      enrollmentToken: "fixture-enrollment-token-12345",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async getChromeConnectorConfiguration(): Promise<ConnectorConfigResult> {
    await Promise.resolve();
    if (typeof this.fixtures.errors?.connectorConfig === "string") {
      return {
        error: this.fixtures.errors.connectorConfig,
        suggestion: "This is a fixture error for testing.",
        requiresReauth: false,
        policySchemas: [],
      };
    }

    const policySchemas = [
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

    const firstOrgUnit = this.fixtures.orgUnits?.[0];
    const targetResource = firstOrgUnit?.orgUnitId ?? "orgunits/root";
    const targetResourceName =
      firstOrgUnit?.orgUnitPath ?? firstOrgUnit?.name ?? null;

    return {
      status: "Resolved",
      policySchemas,
      value: this.fixtures.connectorPolicies ?? [],
      targetResource,
      targetResourceName,
      attemptedTargets:
        this.fixtures.orgUnits
          ?.map((ou: { orgUnitId?: string | null }) => ou.orgUnitId ?? "")
          .filter(Boolean) ?? [],
    };
  }

  // eslint-disable-next-line class-methods-use-this
  async debugAuth(): Promise<DebugAuthResult> {
    await Promise.resolve();
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

  // eslint-disable-next-line class-methods-use-this
  async draftPolicyChange(
    args: z.infer<typeof DraftPolicyChangeSchema>
  ): Promise<DraftPolicyChangeResult> {
    await Promise.resolve();
    const proposalId = `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      _type: "ui.confirmation",
      proposalId,
      title: `Proposed Change: ${args.policyName}`,
      description: args.reasoning,
      diff: args.proposedValue,
      target: args.targetUnit,
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

  // eslint-disable-next-line class-methods-use-this
  async applyPolicyChange(
    args: z.infer<typeof ApplyPolicyChangeSchema>
  ): Promise<ApplyPolicyChangeResult> {
    await Promise.resolve();
    return {
      _type: "ui.success",
      message: `Policy ${args.policySchemaId} applied successfully`,
      policySchemaId: args.policySchemaId,
      targetResource: args.targetResource,
      appliedValue: args.value,
    };
  }

  // eslint-disable-next-line class-methods-use-this
  async createDLPRule(
    args: z.infer<typeof CreateDLPRuleSchema>
  ): Promise<CreateDLPRuleResult> {
    await Promise.resolve();
    return {
      _type: "ui.success",
      message: `DLP rule "${args.displayName}" created successfully`,
      ruleName: `policies/dlp-${Date.now()}`,
      displayName: args.displayName,
      targetOrgUnit: args.targetOrgUnit,
      triggers: args.triggers,
      action: args.action,
      consoleUrl: "https://admin.google.com/ac/chrome/dlp",
    };
  }

  async getFleetOverview(
    _args: z.infer<typeof GetFleetOverviewSchema>
  ): Promise<{
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
  }> {
    await Promise.resolve();
    const eventCount = this.fixtures.auditEvents?.items?.length ?? 0;
    const dlpRuleCount = this.fixtures.dlpRules?.length ?? 0;
    const connectorPolicyCount = this.fixtures.connectorPolicies?.length ?? 0;

    return {
      headline: "I just reviewed your Chrome fleet.",
      summary: `Found ${eventCount} recent events, ${dlpRuleCount} DLP rules, and ${connectorPolicyCount} connector policies.`,
      postureCards: [
        {
          label: "Recent events",
          value: `${eventCount}`,
          note: "Chrome activity logs",
          source: "Admin SDK Reports",
          action: "Show recent Chrome events",
          lastUpdated: new Date().toISOString(),
        },
        {
          label: "DLP rules",
          value: `${dlpRuleCount}`,
          note: "Customer DLP policies",
          source: "Cloud Identity",
          action: "List active DLP rules",
          lastUpdated: new Date().toISOString(),
        },
        {
          label: "Connector policies",
          value: `${connectorPolicyCount}`,
          note: "Connector policy resolve",
          source: "Chrome Policy",
          action: "Check connector configuration",
          lastUpdated: new Date().toISOString(),
        },
      ],
      suggestions: [
        "List active DLP rules",
        "Show recent Chrome events",
        "Check connector configuration",
      ],
      sources: ["Admin SDK Reports", "Cloud Identity", "Chrome Policy"],
    };
  }
}

/**
 * Load and merge fixture data from base and override files.
 */
export function loadFixtureData(
  baseData: unknown,
  overrideData?: unknown
): FixtureData {
  const base = isPlainObject(baseData) ? baseData : {};
  const override = isPlainObject(overrideData) ? overrideData : {};

  const merged = mergeJson(base, override);
  const mergedObject = isPlainObject(merged) ? merged : {};

  return {
    orgUnits: Array.isArray(mergedObject.orgUnits)
      ? mergedObject.orgUnits
      : undefined,
    auditEvents: isPlainObject(mergedObject.auditEvents)
      ? (mergedObject.auditEvents as FixtureData["auditEvents"])
      : undefined,
    dlpRules: Array.isArray(mergedObject.dlpRules)
      ? mergedObject.dlpRules
      : undefined,
    connectorPolicies: Array.isArray(mergedObject.connectorPolicies)
      ? mergedObject.connectorPolicies
      : undefined,
    policySchemas: Array.isArray(mergedObject.policySchemas)
      ? mergedObject.policySchemas
      : undefined,
    chromeReports: isPlainObject(mergedObject.chromeReports)
      ? mergedObject.chromeReports
      : undefined,
    enrollmentToken: isPlainObject(mergedObject.enrollmentToken)
      ? (mergedObject.enrollmentToken as FixtureData["enrollmentToken"])
      : undefined,
    browsers: Array.isArray(mergedObject.browsers)
      ? mergedObject.browsers
      : undefined,
    errors: isPlainObject(mergedObject.errors)
      ? (mergedObject.errors as FixtureData["errors"])
      : undefined,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeJson(base: unknown, override: unknown): unknown {
  if (override === undefined) {
    return base;
  }
  if (base === undefined) {
    return override;
  }
  if (isPlainObject(base) && isPlainObject(override)) {
    const result: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(override)) {
      result[key] = mergeJson(result[key], value);
    }
    return result;
  }
  return override;
}
