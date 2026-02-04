/**
 * Core type definitions for MCP tool executor results and interfaces.
 *
 * Result types are imported from their canonical definitions in executor files.
 * This provides a single import point for consumers while keeping definitions
 * close to their implementation.
 */

import { type z } from "zod";

import { type ChromeEventsResult } from "./executor/chrome-events";
import { type ConnectorConfigResult } from "./executor/connector";
import { type ListDLPRulesResult } from "./executor/dlp-list";
import { type EnrollBrowserResult } from "./executor/enrollment";
import { type ListOrgUnitsResult } from "./executor/org-units-api";
import {
  type ApplyPolicyChangeSchema,
  type CreateDLPRuleSchema,
  type DraftPolicyChangeSchema,
  type EnrollBrowserSchema,
  type FleetOverviewResponse,
  type GetChromeEventsSchema,
  type GetFleetOverviewSchema,
  type ListDLPRulesSchema,
} from "./registry";

/**
 * Re-export result types from their canonical executor definitions.
 */
export type {
  ChromeEventsResult,
  ConnectorConfigResult,
  EnrollBrowserResult,
  ListDLPRulesResult,
  ListOrgUnitsResult,
};

/**
 * Result from debug authentication check.
 */
export type DebugAuthResult =
  | {
      scopes: string[];
      expiresIn: number;
      email?: string;
      accessType?: string;
    }
  | { error: string };

/**
 * Result from drafting a policy change proposal.
 */
export interface DraftPolicyChangeResult {
  _type: "ui.confirmation";
  proposalId?: string;
  title: string;
  description: string;
  diff: unknown;
  target: string;
  adminConsoleUrl: string;
  intent: string;
  status: string;
  applyParams?: {
    policySchemaId: string;
    targetResource: string;
    value: unknown;
  };
}

/**
 * Result from applying a policy change.
 */
export interface ApplyPolicyChangeResult {
  _type: "ui.success" | "ui.error";
  message: string;
  policySchemaId: string;
  targetResource: string;
  appliedValue?: unknown;
  error?: string;
  suggestion?: string;
}

/**
 * Result from creating a DLP rule.
 */
export interface CreateDLPRuleResult {
  _type: "ui.success" | "ui.manual_steps";
  message: string;
  ruleName?: string;
  displayName: string;
  targetOrgUnit: string;
  triggers: string[];
  action: string;
  consoleUrl: string;
  error?: string;
  steps?: string[];
}

/**
 * Contract for CEP tool execution. Implementations include CepToolExecutor
 * for production API calls and FixtureToolExecutor for deterministic testing.
 */
export interface IToolExecutor {
  getChromeEvents(
    args: z.infer<typeof GetChromeEventsSchema>
  ): Promise<ChromeEventsResult>;

  listDLPRules(
    args?: z.infer<typeof ListDLPRulesSchema>
  ): Promise<ListDLPRulesResult>;

  listOrgUnits(): Promise<ListOrgUnitsResult>;

  enrollBrowser(
    args: z.infer<typeof EnrollBrowserSchema>
  ): Promise<EnrollBrowserResult>;

  getChromeConnectorConfiguration(): Promise<ConnectorConfigResult>;

  debugAuth(): Promise<DebugAuthResult>;

  draftPolicyChange(
    args: z.infer<typeof DraftPolicyChangeSchema>
  ): Promise<DraftPolicyChangeResult>;

  applyPolicyChange(
    args: z.infer<typeof ApplyPolicyChangeSchema>
  ): Promise<ApplyPolicyChangeResult>;

  createDLPRule(
    args: z.infer<typeof CreateDLPRuleSchema>
  ): Promise<CreateDLPRuleResult>;

  getFleetOverview(args: z.infer<typeof GetFleetOverviewSchema>): Promise<
    | FleetOverviewResponse
    | {
        headline: string;
        summary: string;
        postureCards: unknown[];
        suggestions: string[];
        sources: string[];
      }
  >;
}

/**
 * Shape of fixture data used by FixtureToolExecutor for eval testing.
 */
export interface FixtureData {
  orgUnits?: {
    orgUnitId?: string | null;
    name?: string | null;
    orgUnitPath?: string | null;
    parentOrgUnitId?: string | null;
    description?: string | null;
  }[];
  auditEvents?: {
    items?: {
      kind?: string;
      id?: {
        time?: string;
        uniqueQualifier?: string;
        applicationName?: string;
      };
      actor?: { email?: string; profileId?: string };
      events?: {
        type?: string;
        name?: string;
        parameters?: {
          name?: string;
          value?: string;
          intValue?: string;
          boolValue?: boolean;
          multiValue?: string[];
        }[];
      }[];
    }[];
    nextPageToken?: string;
  };
  dlpRules?: {
    name?: string;
    displayName?: string;
    description?: string;
    settingType?: string;
    policyType?: string;
    orgUnit?: string;
    targetResource?: string | null;
    resourceName?: string;
    condition?: unknown;
    action?: string;
    triggers?: string[];
    enabled?: boolean;
    note?: string;
    consoleUrl?: string;
  }[];
  connectorPolicies?: {
    targetKey?: { targetResource?: string };
    value?: { policySchema?: string; value?: Record<string, unknown> };
    sourceKey?: { targetResource?: string };
  }[];
  policySchemas?: { name?: string; policyDescription?: string }[];
  chromeReports?: Record<string, unknown>;
  enrollmentToken?: {
    token?: string;
    expiresAt?: string | null;
    targetResource?: string;
    status?: "valid" | "expired" | "revoked";
    error?: string;
  };
  browsers?: {
    deviceId?: string;
    machineName?: string;
    browserVersion?: string;
    lastActivityTime?: string;
    orgUnitPath?: string;
    enrolledTime?: string;
  }[];
  errors?: {
    chromeEvents?: string;
    dlpRules?: string;
    connectorConfig?: string;
    orgUnits?: string;
    enrollBrowser?: string;
    browsers?: string;
  };
}
