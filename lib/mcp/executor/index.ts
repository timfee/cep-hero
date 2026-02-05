/**
 * Main CEP tool executor that orchestrates all Google API operations.
 */

import { OAuth2Client } from "google-auth-library";
import { google as googleApis } from "googleapis";
import { type z } from "zod";

import { extractFleetOverviewFacts } from "@/lib/mcp/fleet-overview/extract";
import {
  buildFallbackOverview,
  summarizeFleetOverview,
} from "@/lib/mcp/fleet-overview/summarize";
import {
  type GetChromeEventsSchema,
  type GetFleetOverviewSchema,
} from "@/lib/mcp/schemas";
import { searchDocs, searchPolicies } from "@/lib/upstash/search";

import { debugAuth } from "./auth";
import { getChromeEvents, getChromeEventsWindowSummary } from "./chrome-events";
import { getChromeConnectorConfiguration } from "./connector";
import { fetchOrgUnitContext, type OrgUnitContext } from "./context";
import { createDLPRule, type CreateDLPRuleArgs } from "./dlp-create";
import { listDLPRules, type ListDLPRulesArgs } from "./dlp-list";
import { enrollBrowser, type EnrollBrowserArgs } from "./enrollment";
import { listOrgUnits } from "./org-units-api";
import {
  applyPolicyChange,
  draftPolicyChange,
  type ApplyPolicyChangeArgs,
  type DraftPolicyChangeArgs,
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
  private resolvedCustomerIdPromise: Promise<string> | null = null;

  constructor(accessToken: string, customerId = "my_customer") {
    this.customerId = customerId;
    const client = new OAuth2Client();
    client.setCredentials({ access_token: accessToken });
    this.auth = client;
  }

  /**
   * Lazily fetches and caches org unit context for the session.
   */
  private getOrgUnitContext() {
    this.orgUnitContextPromise ??= fetchOrgUnitContext(
      this.auth,
      this.customerId
    );
    return this.orgUnitContextPromise;
  }

  /**
   * Resolves the actual customer ID from Chrome Policy API.
   * Cloud Identity API requires the actual obfuscated ID (e.g., "C046psxkn"),
   * not "my_customer".
   */
  private resolveCustomerId(): Promise<string> {
    // If already a specific customer ID (not my_customer), use it directly
    if (this.customerId !== "my_customer") {
      return Promise.resolve(this.customerId);
    }

    // Lazily resolve and cache the actual customer ID
    if (this.resolvedCustomerIdPromise === null) {
      this.resolvedCustomerIdPromise = this.fetchActualCustomerId();
    }
    return this.resolvedCustomerIdPromise;
  }

  /**
   * Fetches the actual obfuscated customer ID using Chrome Policy API.
   * Throws an error if resolution fails since Cloud Identity API cannot use "my_customer".
   */
  private async fetchActualCustomerId(): Promise<string> {
    try {
      const policy = googleApis.chromepolicy({
        version: "v1",
        auth: this.auth,
      });
      const res = await policy.customers.policySchemas.list({
        parent: "customers/my_customer",
        pageSize: 1,
      });
      const schemaName = res.data.policySchemas?.[0]?.name ?? "";
      const match = schemaName.match(/customers\/([^/]+)\//);
      if (match?.[1]) {
        console.log("[executor] resolved customer ID:", match[1]);
        return match[1];
      }
      throw new Error("No policy schemas found to extract customer ID");
    } catch (error) {
      console.warn(
        "[executor] unable to resolve customer ID; Cloud Identity APIs require the actual ID",
        error instanceof Error ? error.message : error
      );
      throw new Error(
        "Failed to resolve customer ID from Chrome Policy API. " +
          "Ensure Chrome Policy API is accessible or provide an explicit customerId.",
        { cause: error }
      );
    }
  }

  /**
   * Fetches Chrome audit events from the Admin SDK Reports API.
   */
  getChromeEvents(args: ChromeEventsArgs) {
    return getChromeEvents(this.auth, this.customerId, args);
  }

  /**
   * Lists DLP rules from Cloud Identity with org unit resolution.
   * Uses resolved customer ID since Cloud Identity API requires the actual ID.
   */
  async listDLPRules(args: ListDLPRulesArgs = {}) {
    const [orgUnitContext, resolvedCustomerId] = await Promise.all([
      this.getOrgUnitContext(),
      this.resolveCustomerId(),
    ]);
    return listDLPRules(this.auth, resolvedCustomerId, orgUnitContext, args);
  }

  /**
   * Lists all organizational units for the customer.
   */
  listOrgUnits() {
    return listOrgUnits(this.auth, this.customerId);
  }

  /**
   * Generates a browser enrollment token for the specified org unit.
   */
  enrollBrowser(args: EnrollBrowserArgs) {
    return enrollBrowser(this.auth, this.customerId, args);
  }

  /**
   * Retrieves Chrome connector policy configurations.
   */
  async getChromeConnectorConfiguration() {
    const orgUnitContext = await this.getOrgUnitContext();
    return getChromeConnectorConfiguration(
      this.auth,
      this.customerId,
      orgUnitContext
    );
  }

  /**
   * Validates the OAuth token and returns scope/expiry info.
   */
  debugAuth() {
    return debugAuth(this.auth);
  }

  /**
   * Creates a policy change proposal for user review before application.
   */
  async draftPolicyChange(args: DraftPolicyChangeArgs) {
    const orgUnitContext = await this.getOrgUnitContext();
    return draftPolicyChange(orgUnitContext, args);
  }

  /**
   * Applies a confirmed policy change via the Chrome Policy API.
   */
  applyPolicyChange(args: ApplyPolicyChangeArgs) {
    return applyPolicyChange(this.auth, this.customerId, args);
  }

  /**
   * Creates a new DLP rule in Cloud Identity.
   * Uses resolved customer ID since Cloud Identity API requires the actual ID.
   */
  async createDLPRule(args: CreateDLPRuleArgs) {
    const [orgUnitContext, resolvedCustomerId] = await Promise.all([
      this.getOrgUnitContext(),
      this.resolveCustomerId(),
    ]);
    return createDLPRule(this.auth, resolvedCustomerId, orgUnitContext, args);
  }

  /**
   * Fetches relevant documentation and policy references for a query.
   */
  static async getKnowledgeContext(query: string) {
    if (query.trim() === "") {
      return { docs: null, policies: null };
    }

    const [docs, policies] = await Promise.all([
      searchDocs(query, 3),
      searchPolicies(query, 3),
    ]);

    return { docs, policies };
  }

  /**
   * Aggregates fleet data and generates an AI-powered security summary.
   */
  async getFleetOverview(args: FleetOverviewArgs) {
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
