import { type z } from "zod";

import {
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
      attemptedTargets?: string[];
      errors?: { targetResource: string; message: string }[];
    }
  | {
      error: string;
      suggestion: string;
      requiresReauth: boolean;
      policySchemas?: string[];
      targetResource?: string;
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
  title: string;
  description: string;
  diff: unknown;
  target: string;
  adminConsoleUrl: string;
  intent: string;
  status: string;
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
    id: string;
    displayName: string;
    description: string;
    resourceName: string;
    consoleUrl: string;
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
