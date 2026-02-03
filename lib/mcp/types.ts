import { type z } from "zod";

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

export type ChromeEventsResult =
  | {
      events: {
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
      nextPageToken: string | null;
    }
  | { error: string; suggestion: string; requiresReauth: boolean };

export type DLPRulesResult =
  | {
      rules: {
        id: string;
        displayName: string;
        description: string;
        settingType: string;
        orgUnit: string;
        policyType: string;
        resourceName: string;
        consoleUrl: string;
      }[];
      help?: unknown;
    }
  | { error: string; suggestion: string; requiresReauth: boolean };

export type OrgUnitsResult =
  | {
      orgUnits: {
        orgUnitId?: string | null;
        name?: string | null;
        orgUnitPath?: string | null;
        parentOrgUnitId?: string | null;
        description?: string | null;
      }[];
    }
  | { error: string; suggestion: string; requiresReauth: boolean };

export type EnrollBrowserResult =
  | { enrollmentToken: string; expiresAt: string | null }
  | { error: string; suggestion: string; requiresReauth: boolean };

export type ConnectorConfigResult =
  | {
      status: string;
      policySchemas: string[];
      value: {
        targetKey?: { targetResource?: string };
        value?: { policySchema?: string; value?: Record<string, unknown> };
        sourceKey?: { targetResource?: string };
      }[];
      targetResource?: string;
      targetResourceName?: string | null;
      attemptedTargets?: string[];
      errors?: { targetResource: string; message: string }[];
    }
  | {
      error: string;
      suggestion: string;
      requiresReauth: boolean;
      policySchemas?: string[];
      targetResource?: string;
      targetResourceName?: string | null;
      attemptedTargets?: string[];
    };

export type DebugAuthResult =
  | {
      scopes: string[];
      expiresIn: number;
      email?: string;
      accessType?: string;
    }
  | { error: string };

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

export interface ApplyPolicyChangeResult {
  _type: "ui.success" | "ui.error";
  message: string;
  policySchemaId: string;
  targetResource: string;
  appliedValue?: unknown;
  error?: string;
  suggestion?: string;
}

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

export interface IToolExecutor {
  getChromeEvents(
    args: z.infer<typeof GetChromeEventsSchema>
  ): Promise<ChromeEventsResult>;

  listDLPRules(
    args?: z.infer<typeof ListDLPRulesSchema>
  ): Promise<DLPRulesResult>;

  listOrgUnits(): Promise<OrgUnitsResult>;

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
    condition?: unknown;
    action?: string;
    triggers?: string[];
    enabled?: boolean;
    note?: string;
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
