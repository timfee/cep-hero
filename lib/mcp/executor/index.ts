import { OAuth2Client } from "google-auth-library";
import { type z } from "zod";

import {
  buildFallbackOverview,
  extractFleetOverviewFacts,
  summarizeFleetOverview,
  type FleetKnowledgeContext,
} from "@/lib/mcp/fleet-overview";
import {
  type FleetOverviewResponse,
  type GetChromeEventsSchema,
  type GetFleetOverviewSchema,
} from "@/lib/mcp/schemas";
import { searchDocs, searchPolicies } from "@/lib/upstash/search";

import { debugAuth, type DebugAuthResult } from "./auth";
import { getChromeEvents, getChromeEventsWindowSummary } from "./chrome-events";
import {
  getChromeConnectorConfiguration,
  type ConnectorConfigResult,
} from "./connector";
import { fetchOrgUnitContext, type OrgUnitContext } from "./context";
import {
  createDLPRule,
  type CreateDLPRuleArgs,
  type CreateDLPRuleResult,
} from "./dlp-create";
import {
  listDLPRules,
  type ListDLPRulesArgs,
  type ListDLPRulesResult,
} from "./dlp-list";
import {
  enrollBrowser,
  type EnrollBrowserArgs,
  type EnrollBrowserResult,
} from "./enrollment";
import { listOrgUnits, type ListOrgUnitsResult } from "./org-units-api";
import {
  applyPolicyChange,
  draftPolicyChange,
  type ApplyPolicyChangeArgs,
  type ApplyPolicyChangeResult,
  type DraftPolicyChangeArgs,
  type DraftPolicyChangeResult,
} from "./policy";

type ChromeEventsArgs = z.infer<typeof GetChromeEventsSchema>;
type FleetOverviewArgs = z.infer<typeof GetFleetOverviewSchema>;

/**
 * Main executor class for Chrome Enterprise Premium tools.
 */
export class CepToolExecutor {
  private auth: OAuth2Client;
  private customerId: string;
  private orgUnitContextPromise: Promise<OrgUnitContext> | null = null;

  constructor(accessToken: string, customerId = "my_customer") {
    this.customerId = customerId;
    const client = new OAuth2Client();
    client.setCredentials({ access_token: accessToken });
    this.auth = client;
  }

  private async getOrgUnitContext(): Promise<OrgUnitContext> {
    this.orgUnitContextPromise ??= fetchOrgUnitContext(
      this.auth,
      this.customerId
    );
    const result = await this.orgUnitContextPromise;
    return result;
  }

  async getChromeEvents(args: ChromeEventsArgs) {
    const result = await getChromeEvents(this.auth, this.customerId, args);
    return result;
  }

  async listDLPRules(args: ListDLPRulesArgs = {}): Promise<ListDLPRulesResult> {
    const orgUnitContext = await this.getOrgUnitContext();
    return listDLPRules(this.auth, this.customerId, orgUnitContext, args);
  }

  async listOrgUnits(): Promise<ListOrgUnitsResult> {
    const result = await listOrgUnits(this.auth, this.customerId);
    return result;
  }

  async enrollBrowser(args: EnrollBrowserArgs): Promise<EnrollBrowserResult> {
    const result = await enrollBrowser(this.auth, this.customerId, args);
    return result;
  }

  async getChromeConnectorConfiguration(): Promise<ConnectorConfigResult> {
    const orgUnitContext = await this.getOrgUnitContext();
    return getChromeConnectorConfiguration(
      this.auth,
      this.customerId,
      orgUnitContext
    );
  }

  async debugAuth(): Promise<DebugAuthResult> {
    const result = await debugAuth(this.auth);
    return result;
  }

  async draftPolicyChange(
    args: DraftPolicyChangeArgs
  ): Promise<DraftPolicyChangeResult> {
    const orgUnitContext = await this.getOrgUnitContext();
    return draftPolicyChange(orgUnitContext, args);
  }

  async applyPolicyChange(
    args: ApplyPolicyChangeArgs
  ): Promise<ApplyPolicyChangeResult> {
    const result = await applyPolicyChange(this.auth, this.customerId, args);
    return result;
  }

  async createDLPRule(args: CreateDLPRuleArgs): Promise<CreateDLPRuleResult> {
    const orgUnitContext = await this.getOrgUnitContext();
    return createDLPRule(this.auth, this.customerId, orgUnitContext, args);
  }

  static async getKnowledgeContext(
    query: string
  ): Promise<FleetKnowledgeContext> {
    if (query.trim() === "") {
      return { docs: null, policies: null };
    }

    const [docs, policies] = await Promise.all([
      searchDocs(query, 3),
      searchPolicies(query, 3),
    ]);

    return { docs, policies };
  }

  async getFleetOverview(
    args: FleetOverviewArgs
  ): Promise<FleetOverviewResponse | ReturnType<typeof buildFallbackOverview>> {
    const { maxEvents = 50, knowledgeQuery } = args;

    const eventsWindowSummary = await getChromeEventsWindowSummary(
      this.auth,
      this.customerId,
      {
        windowDays: 7,
        pageSize: 1000,
        maxPages: 10,
        sampleSize: maxEvents,
      }
    );

    const [dlpResult, connectorResult] = await Promise.all([
      this.listDLPRules(),
      this.getChromeConnectorConfiguration(),
    ]);

    const dataPayload = {
      eventsResult: eventsWindowSummary.events,
      eventsWindow: {
        totalCount: eventsWindowSummary.totalCount,
        sampled: eventsWindowSummary.sampled,
        windowStart: eventsWindowSummary.windowStart.toISOString(),
        windowEnd: eventsWindowSummary.windowEnd.toISOString(),
      },
      dlpResult,
      connectorResult,
    };

    const facts = extractFleetOverviewFacts(
      eventsWindowSummary,
      dlpResult,
      connectorResult
    );

    const knowledge = await CepToolExecutor.getKnowledgeContext(
      knowledgeQuery ?? ""
    );

    try {
      return await summarizeFleetOverview(facts, dataPayload, knowledge);
    } catch {
      return buildFallbackOverview(facts);
    }
  }
}
