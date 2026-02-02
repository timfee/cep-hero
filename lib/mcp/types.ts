import { z } from "zod";

import type { FleetOverviewResponse } from "./registry";

import {
  DraftPolicyChangeSchema,
  EnrollBrowserSchema,
  GetChromeEventsSchema,
  GetFleetOverviewSchema,
  ListDLPRulesSchema,
} from "./registry";

export type ChromeEventsResult =
  | {
      events: Array<{
        kind?: string;
        id?: {
          time?: string;
          uniqueQualifier?: string;
          applicationName?: string;
        };
        actor?: { email?: string; profileId?: string };
        events?: Array<{
          type?: string;
          name?: string;
          parameters?: Array<{
            name?: string;
            value?: string;
            intValue?: string;
            boolValue?: boolean;
            multiValue?: string[];
          }>;
        }>;
      }>;
      nextPageToken: string | null;
    }
  | { error: string; suggestion?: string; requiresReauth?: boolean };

export type DLPRulesResult =
  | {
      rules: Array<{
        id: string;
        displayName: string;
        description: string;
        resourceName: string;
        consoleUrl: string;
      }>;
      help?: unknown;
    }
  | { error: string; suggestion?: string; requiresReauth?: boolean };

export type OrgUnitsResult =
  | {
      orgUnits: Array<{
        orgUnitId?: string | null;
        name?: string | null;
        orgUnitPath?: string | null;
        parentOrgUnitId?: string | null;
        description?: string | null;
      }>;
    }
  | { error: string; suggestion?: string; requiresReauth?: boolean };

export type EnrollBrowserResult =
  | { enrollmentToken: string; expiresAt: string | null }
  | { error: string; suggestion?: string; requiresReauth?: boolean };

export type ConnectorConfigResult =
  | {
      status: string;
      policySchemas: string[];
      value: Array<{
        targetKey?: { targetResource?: string };
        value?: { policySchema?: string; value?: Record<string, unknown> };
        sourceKey?: { targetResource?: string };
      }>;
      targetResource?: string;
      attemptedTargets?: string[];
      errors?: Array<{ targetResource: string; message: string }>;
    }
  | {
      error: string;
      suggestion?: string;
      policySchemas?: string[];
      targetResource?: string;
      attemptedTargets?: string[];
      requiresReauth?: boolean;
    };

export type DebugAuthResult =
  | {
      scopes: string[];
      expiresIn: number;
      email?: string;
      accessType?: string;
    }
  | { error: string };

export type DraftPolicyChangeResult = {
  _type: "ui.confirmation";
  title: string;
  description: string;
  diff: unknown;
  target: string;
  adminConsoleUrl: string;
  intent: string;
  status: string;
};

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

export type FixtureData = {
  orgUnits?: Array<{
    orgUnitId?: string | null;
    name?: string | null;
    orgUnitPath?: string | null;
    parentOrgUnitId?: string | null;
    description?: string | null;
  }>;
  auditEvents?: {
    items?: Array<{
      kind?: string;
      id?: {
        time?: string;
        uniqueQualifier?: string;
        applicationName?: string;
      };
      actor?: { email?: string; profileId?: string };
      events?: Array<{
        type?: string;
        name?: string;
        parameters?: Array<{
          name?: string;
          value?: string;
          intValue?: string;
          boolValue?: boolean;
          multiValue?: string[];
        }>;
      }>;
    }>;
    nextPageToken?: string;
  };
  dlpRules?: Array<{
    id: string;
    displayName: string;
    description: string;
    resourceName: string;
    consoleUrl: string;
  }>;
  connectorPolicies?: Array<{
    targetKey?: { targetResource?: string };
    value?: { policySchema?: string; value?: Record<string, unknown> };
    sourceKey?: { targetResource?: string };
  }>;
  policySchemas?: Array<{ name?: string; policyDescription?: string }>;
  chromeReports?: Record<string, unknown>;
  errors?: {
    chromeEvents?: string;
    dlpRules?: string;
    connectorConfig?: string;
    orgUnits?: string;
  };
};
