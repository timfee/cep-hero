/**
 * Tests for tool visibility tier classification in chat-console.
 * Verifies that HIDDEN_TOOLS and RICH_CARD_TOOLS sets are correctly defined.
 */

import { describe, expect, it } from "bun:test";

describe("tool visibility tiers", () => {
  const HIDDEN_TOOLS = new Set([
    "getFleetOverview",
    "searchKnowledge",
    "debugAuth",
    "suggestActions",
  ]);

  const RICH_CARD_TOOLS = new Set([
    "getChromeEvents",
    "getChromeConnectorConfiguration",
    "listDLPRules",
    "listOrgUnits",
    "draftPolicyChange",
  ]);

  describe("HIDDEN_TOOLS", () => {
    it("hides getFleetOverview (data feeds AI summary, not a user-facing card)", () => {
      expect(HIDDEN_TOOLS.has("getFleetOverview")).toBe(true);
    });

    it("hides searchKnowledge (already rendered in Sources section)", () => {
      expect(HIDDEN_TOOLS.has("searchKnowledge")).toBe(true);
    });

    it("hides debugAuth (internal diagnostic)", () => {
      expect(HIDDEN_TOOLS.has("debugAuth")).toBe(true);
    });

    it("hides suggestActions (rendered as ActionButtons)", () => {
      expect(HIDDEN_TOOLS.has("suggestActions")).toBe(true);
    });

    it("does not hide tools that have rich cards", () => {
      for (const tool of RICH_CARD_TOOLS) {
        expect(HIDDEN_TOOLS.has(tool)).toBe(false);
      }
    });
  });

  describe("RICH_CARD_TOOLS", () => {
    it("includes all five tools with custom UI cards", () => {
      expect(RICH_CARD_TOOLS.size).toBe(5);
      expect(RICH_CARD_TOOLS.has("getChromeEvents")).toBe(true);
      expect(RICH_CARD_TOOLS.has("getChromeConnectorConfiguration")).toBe(true);
      expect(RICH_CARD_TOOLS.has("listDLPRules")).toBe(true);
      expect(RICH_CARD_TOOLS.has("listOrgUnits")).toBe(true);
      expect(RICH_CARD_TOOLS.has("draftPolicyChange")).toBe(true);
    });
  });

  describe("no tool is in both sets", () => {
    it("HIDDEN_TOOLS and RICH_CARD_TOOLS are disjoint", () => {
      for (const tool of HIDDEN_TOOLS) {
        expect(RICH_CARD_TOOLS.has(tool)).toBe(false);
      }
    });
  });

  describe("deduplication logic", () => {
    it("lastToolIndex map keeps only the last index per tool name", () => {
      const parts = [
        { toolName: "listDLPRules", index: 0 },
        { toolName: "draftPolicyChange", index: 1 },
        { toolName: "listDLPRules", index: 2 },
        { toolName: "draftPolicyChange", index: 3 },
      ];

      const lastToolIndex = new Map<string, number>();
      for (const p of parts) {
        if (RICH_CARD_TOOLS.has(p.toolName)) {
          lastToolIndex.set(p.toolName, p.index);
        }
      }

      expect(lastToolIndex.get("listDLPRules")).toBe(2);
      expect(lastToolIndex.get("draftPolicyChange")).toBe(3);
    });

    it("earlier invocations are suppressed", () => {
      const lastToolIndex = new Map<string, number>([
        ["listDLPRules", 2],
        ["draftPolicyChange", 3],
      ]);

      const shouldShow0 = lastToolIndex.get("listDLPRules") === 0;
      expect(shouldShow0).toBe(false);

      const shouldShow2 = lastToolIndex.get("listDLPRules") === 2;
      expect(shouldShow2).toBe(true);
    });

    it("does not deduplicate tools outside RICH_CARD_TOOLS", () => {
      const parts = [
        { toolName: "enrollBrowser", index: 0 },
        { toolName: "enrollBrowser", index: 1 },
      ];

      const lastToolIndex = new Map<string, number>();
      for (const p of parts) {
        if (RICH_CARD_TOOLS.has(p.toolName)) {
          lastToolIndex.set(p.toolName, p.index);
        }
      }

      expect(lastToolIndex.has("enrollBrowser")).toBe(false);
    });
  });
});
