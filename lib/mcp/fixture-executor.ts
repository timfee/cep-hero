import { z } from "zod";

import type {
  ChromeEventsResult,
  ConnectorConfigResult,
  DebugAuthResult,
  DLPRulesResult,
  DraftPolicyChangeResult,
  FixtureData,
  IToolExecutor,
  OrgUnitsResult,
  EnrollBrowserResult,
} from "./types";

import {
  DraftPolicyChangeSchema,
  EnrollBrowserSchema,
  GetChromeEventsSchema,
  GetFleetOverviewSchema,
  ListDLPRulesSchema,
} from "./registry";

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
    if (this.fixtures.errors?.chromeEvents) {
      return {
        error: this.fixtures.errors.chromeEvents,
        suggestion: "This is a fixture error for testing.",
        requiresReauth: false,
      };
    }

    const items = this.fixtures.auditEvents?.items ?? [];
    const maxResults = args.maxResults ?? 10;
    const events = items.slice(0, maxResults);

    return {
      events,
      nextPageToken: this.fixtures.auditEvents?.nextPageToken ?? null,
    };
  }

  async listDLPRules(
    _args?: z.infer<typeof ListDLPRulesSchema>
  ): Promise<DLPRulesResult> {
    if (this.fixtures.errors?.dlpRules) {
      return {
        error: this.fixtures.errors.dlpRules,
        suggestion: "This is a fixture error for testing.",
        requiresReauth: false,
      };
    }

    return {
      rules: this.fixtures.dlpRules ?? [],
    };
  }

  async listOrgUnits(): Promise<OrgUnitsResult> {
    if (this.fixtures.errors?.orgUnits) {
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
    // Check for error injection
    if (this.fixtures.errors?.enrollBrowser) {
      return {
        error: this.fixtures.errors.enrollBrowser,
        suggestion:
          "Ensure the caller has Chrome policy admin rights and the API is enabled.",
        requiresReauth: false,
      };
    }

    // Check for custom enrollment token fixture
    if (this.fixtures.enrollmentToken) {
      const { token, expiresAt, status, error } = this.fixtures.enrollmentToken;

      // If token has error or bad status, return error
      if (error) {
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
    if (this.fixtures.errors?.connectorConfig) {
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

    return {
      status: "Resolved",
      policySchemas,
      value: this.fixtures.connectorPolicies ?? [],
      targetResource: this.fixtures.orgUnits?.[0]?.orgUnitId ?? "orgunits/root",
      attemptedTargets:
        this.fixtures.orgUnits
          ?.map((ou: { orgUnitId?: string | null }) => ou.orgUnitId ?? "")
          .filter(Boolean) ?? [],
    };
  }

  async debugAuth(): Promise<DebugAuthResult> {
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

  async draftPolicyChange(
    args: z.infer<typeof DraftPolicyChangeSchema>
  ): Promise<DraftPolicyChangeResult> {
    return {
      _type: "ui.confirmation",
      title: `Proposed Change: ${args.policyName}`,
      description: args.reasoning,
      diff: args.proposedValue,
      target: args.targetUnit,
      adminConsoleUrl:
        args.adminConsoleUrl ?? "https://admin.google.com/ac/chrome/settings",
      intent: "update_policy",
      status: "pending_approval",
    };
  }

  async getFleetOverview(
    _args: z.infer<typeof GetFleetOverviewSchema>
  ): Promise<{
    headline: string;
    summary: string;
    postureCards: Array<{
      label: string;
      value: string;
      note: string;
      source: string;
      action: string;
      lastUpdated?: string;
    }>;
    suggestions: string[];
    sources: string[];
  }> {
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

  const merged = mergeJson(base, override) as Record<string, unknown>;

  return {
    orgUnits: Array.isArray(merged.orgUnits) ? merged.orgUnits : undefined,
    auditEvents: isPlainObject(merged.auditEvents)
      ? (merged.auditEvents as FixtureData["auditEvents"])
      : undefined,
    dlpRules: Array.isArray(merged.dlpRules) ? merged.dlpRules : undefined,
    connectorPolicies: Array.isArray(merged.connectorPolicies)
      ? merged.connectorPolicies
      : undefined,
    policySchemas: Array.isArray(merged.policySchemas)
      ? merged.policySchemas
      : undefined,
    chromeReports: isPlainObject(merged.chromeReports)
      ? (merged.chromeReports as Record<string, unknown>)
      : undefined,
    enrollmentToken: isPlainObject(merged.enrollmentToken)
      ? (merged.enrollmentToken as FixtureData["enrollmentToken"])
      : undefined,
    browsers: Array.isArray(merged.browsers) ? merged.browsers : undefined,
    errors: isPlainObject(merged.errors)
      ? (merged.errors as FixtureData["errors"])
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
