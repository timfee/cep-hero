/**
 * Unit tests for FixtureToolExecutor.
 * Verifies the full ToolExecutor interface using inline fixture data,
 * testing each method with both success and error scenarios.
 */

import { describe, expect, it } from "bun:test";

import { FixtureToolExecutor } from "./fixture-executor";
import { type FixtureData } from "./types";

/**
 * Minimal fixture data for testing with realistic structure.
 */
const BASE_FIXTURES: FixtureData = {
  orgUnits: [
    {
      orgUnitId: "id:root123",
      orgUnitPath: "/",
      name: "Root",
      parentOrgUnitId: null,
    },
    {
      orgUnitId: "id:eng456",
      orgUnitPath: "/Engineering",
      name: "Engineering",
      parentOrgUnitId: "id:root123",
    },
  ],
  auditEvents: {
    items: [
      {
        kind: "admin#reports#activity",
        id: {
          time: "2026-01-20T04:02:22.802Z",
          applicationName: "chrome",
        },
        events: [
          {
            type: "CONTENT_TRANSFER_TYPE",
            name: "CONTENT_TRANSFER",
            parameters: [{ name: "EVENT_RESULT", value: "DETECTED" }],
          },
        ],
      },
      {
        kind: "admin#reports#activity",
        id: {
          time: "2026-01-19T10:00:00.000Z",
          applicationName: "chrome",
        },
        events: [
          {
            type: "CONTENT_TRANSFER_TYPE",
            name: "CONTENT_TRANSFER",
            parameters: [{ name: "EVENT_RESULT", value: "BLOCKED" }],
          },
        ],
      },
      {
        kind: "admin#reports#activity",
        id: {
          time: "2026-01-18T10:00:00.000Z",
          applicationName: "chrome",
        },
        events: [
          {
            type: "LOGIN_EVENT_TYPE",
            name: "LOGIN_EVENT",
          },
        ],
      },
    ],
    nextPageToken: "next-page-abc",
  },
  dlpRules: [
    {
      name: "policies/dlp-rule-1",
      displayName: "Block USB uploads",
      description: "Prevents upload to USB",
      triggers: ["UPLOAD"],
      action: "BLOCK",
      targetResource: "id:eng456",
    },
    {
      name: "policies/dlp-rule-2",
      displayName: "Audit downloads",
      description: "Monitor download activity",
      triggers: ["DOWNLOAD"],
      action: "AUDIT",
      targetResource: null,
    },
  ],
  connectorPolicies: [
    {
      targetKey: { targetResource: "orgunits/root123" },
      value: { policySchema: "chrome.users.ConnectorEnabled" },
    },
  ],
  enrollmentToken: {
    token: "test-enrollment-token",
    expiresAt: "2026-12-31T23:59:59Z",
    status: "valid",
  },
};

describe("FixtureToolExecutor", () => {
  describe("getChromeEvents", () => {
    it("returns events from fixture data", async () => {
      const executor = new FixtureToolExecutor(BASE_FIXTURES);
      const result = await executor.getChromeEvents({});

      expect("events" in result).toBe(true);
      if ("events" in result) {
        expect(result.events).toHaveLength(3);
        expect(result.nextPageToken).toBe("next-page-abc");
      }
    });

    it("limits results by maxResults parameter", async () => {
      const executor = new FixtureToolExecutor(BASE_FIXTURES);
      const result = await executor.getChromeEvents({ maxResults: 1 });

      if ("events" in result) {
        expect(result.events).toHaveLength(1);
      }
    });

    it("returns error when chromeEvents error is configured", async () => {
      const fixtures: FixtureData = {
        ...BASE_FIXTURES,
        errors: { chromeEvents: "API quota exceeded" },
      };
      const executor = new FixtureToolExecutor(fixtures);
      const result = await executor.getChromeEvents({});

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toBe("API quota exceeded");
      }
    });

    it("returns empty events when no auditEvents in fixture", async () => {
      const executor = new FixtureToolExecutor({});
      const result = await executor.getChromeEvents({});

      if ("events" in result) {
        expect(result.events).toHaveLength(0);
        expect(result.nextPageToken).toBeNull();
      }
    });
  });

  describe("listDLPRules", () => {
    it("returns mapped DLP rules from fixture data", async () => {
      const executor = new FixtureToolExecutor(BASE_FIXTURES);
      const result = await executor.listDLPRules();

      expect("rules" in result).toBe(true);
      if ("rules" in result) {
        expect(result.rules).toHaveLength(2);
        expect(result.rules[0].displayName).toBe("Block USB uploads");
        expect(result.rules[0].resourceName).toBe("policies/dlp-rule-1");
      }
    });

    it("returns error when dlpRules error is configured", async () => {
      const fixtures: FixtureData = {
        ...BASE_FIXTURES,
        errors: { dlpRules: "Cloud Identity unavailable" },
      };
      const executor = new FixtureToolExecutor(fixtures);
      const result = await executor.listDLPRules();

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toBe("Cloud Identity unavailable");
      }
    });

    it("returns empty rules when no dlpRules in fixture", async () => {
      const executor = new FixtureToolExecutor({});
      const result = await executor.listDLPRules();

      if ("rules" in result) {
        expect(result.rules).toHaveLength(0);
      }
    });
  });

  describe("listOrgUnits", () => {
    it("returns org units from fixture data", async () => {
      const executor = new FixtureToolExecutor(BASE_FIXTURES);
      const result = await executor.listOrgUnits();

      expect("orgUnits" in result).toBe(true);
      if ("orgUnits" in result) {
        expect(result.orgUnits).toHaveLength(2);
        expect(result.orgUnits[0].orgUnitPath).toBe("/");
      }
    });

    it("returns error when orgUnits error is configured", async () => {
      const fixtures: FixtureData = {
        ...BASE_FIXTURES,
        errors: { orgUnits: "Permission denied" },
      };
      const executor = new FixtureToolExecutor(fixtures);
      const result = await executor.listOrgUnits();

      expect("error" in result).toBe(true);
    });

    it("returns empty array when no orgUnits in fixture", async () => {
      const executor = new FixtureToolExecutor({});
      const result = await executor.listOrgUnits();

      if ("orgUnits" in result) {
        expect(result.orgUnits).toHaveLength(0);
      }
    });
  });

  describe("enrollBrowser", () => {
    it("returns enrollment token from fixture data", async () => {
      const executor = new FixtureToolExecutor(BASE_FIXTURES);
      const result = await executor.enrollBrowser({ orgUnitId: "id:eng456" });

      expect("enrollmentToken" in result).toBe(true);
      if ("enrollmentToken" in result) {
        expect(result.enrollmentToken).toBe("test-enrollment-token");
        expect(result.expiresAt).toBe("2026-12-31T23:59:59Z");
      }
    });

    it("returns error when enrollBrowser error is configured", async () => {
      const fixtures: FixtureData = {
        ...BASE_FIXTURES,
        errors: { enrollBrowser: "No enrollment permissions" },
      };
      const executor = new FixtureToolExecutor(fixtures);
      const result = await executor.enrollBrowser({});

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toBe("No enrollment permissions");
      }
    });

    it("returns default token when no enrollment fixture", async () => {
      const executor = new FixtureToolExecutor({});
      const result = await executor.enrollBrowser({});

      expect("enrollmentToken" in result).toBe(true);
      if ("enrollmentToken" in result) {
        expect(result.enrollmentToken).toBe("fixture-enrollment-token-12345");
      }
    });
  });

  describe("getChromeConnectorConfiguration", () => {
    it("returns connector config from fixture data", async () => {
      const executor = new FixtureToolExecutor(BASE_FIXTURES);
      const result = await executor.getChromeConnectorConfiguration();

      expect("status" in result || "error" in result).toBe(true);
      if ("status" in result) {
        expect(result.status).toBe("Resolved");
        expect(result.policySchemas.length).toBeGreaterThan(0);
      }
    });

    it("returns error when connectorConfig error is configured", async () => {
      const fixtures: FixtureData = {
        ...BASE_FIXTURES,
        errors: { connectorConfig: "API disabled" },
      };
      const executor = new FixtureToolExecutor(fixtures);
      const result = await executor.getChromeConnectorConfiguration();

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toBe("API disabled");
      }
    });
  });

  describe("debugAuth", () => {
    it("returns mock auth response with expected scopes", async () => {
      const executor = new FixtureToolExecutor(BASE_FIXTURES);
      const result = await executor.debugAuth();

      expect("scopes" in result).toBe(true);
      if ("scopes" in result) {
        expect(result.scopes.length).toBeGreaterThan(0);
        expect(result.expiresIn).toBe(3600);
        expect(result.email).toBe("fixture-admin@example.com");
      }
    });
  });

  describe("draftPolicyChange", () => {
    it("returns a proposal with resolved org unit", async () => {
      const executor = new FixtureToolExecutor(BASE_FIXTURES);
      const result = await executor.draftPolicyChange({
        policyName: "chrome.users.SafeBrowsing",
        policySchemaId: "chrome.users.SafeBrowsing",
        proposedValue: { safeBrowsingEnabled: true },
        targetUnit: "id:eng456",
        reasoning: "Enable safe browsing for engineering",
      });

      expect(result._type).toBe("ui.confirmation");
      expect(result.title).toContain("chrome.users.SafeBrowsing");
      expect(result.description).toBe("Enable safe browsing for engineering");
      expect(result.status).toBe("pending_approval");
      expect(result.applyParams).toBeDefined();
    });
  });

  describe("applyPolicyChange", () => {
    it("returns success with echoed arguments", async () => {
      const executor = new FixtureToolExecutor(BASE_FIXTURES);
      const result = await executor.applyPolicyChange({
        policySchemaId: "chrome.users.SafeBrowsing",
        targetResource: "orgunits/eng456",
        value: { safeBrowsingEnabled: "TRUE" },
      });

      expect(result._type).toBe("ui.success");
      expect(result.policySchemaId).toBe("chrome.users.SafeBrowsing");
      expect(result.targetResource).toBe("orgunits/eng456");
      expect(result.appliedValue).toEqual({ safeBrowsingEnabled: "TRUE" });
    });
  });

  describe("createDLPRule", () => {
    it("returns success with rule details", async () => {
      const executor = new FixtureToolExecutor(BASE_FIXTURES);
      const result = await executor.createDLPRule({
        displayName: "Block clipboard paste",
        targetOrgUnit: "id:eng456",
        triggers: ["CLIPBOARD"],
        action: "BLOCK",
      });

      expect(result._type).toBe("ui.success");
      expect(result.displayName).toBe("Block clipboard paste");
      expect(result.triggers).toEqual(["CLIPBOARD"]);
      expect(result.action).toBe("BLOCK");
      expect(result.consoleUrl).toContain("admin.google.com");
    });
  });

  describe("getFleetOverview", () => {
    it("returns summary with correct counts from fixture data", async () => {
      const executor = new FixtureToolExecutor(BASE_FIXTURES);
      const result = await executor.getFleetOverview({});

      expect(result.headline).toBeDefined();
      expect(result.summary).toContain("3");
      expect(result.summary).toContain("2");
      expect(result.summary).toContain("1");
      expect(result.postureCards).toHaveLength(3);
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.sources.length).toBeGreaterThan(0);
    });

    it("handles empty fixture data", async () => {
      const executor = new FixtureToolExecutor({});
      const result = await executor.getFleetOverview({});

      expect(result.headline).toBeDefined();
      expect(result.summary).toContain("0");
      expect(result.postureCards).toHaveLength(3);
    });
  });
});
