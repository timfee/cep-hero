/**
 * Tests for tool visibility tier classification.
 * Verifies HIDDEN_TOOL_NAMES and DEDUPED_CARD_TOOLS are correctly defined and disjoint.
 */

import { describe, expect, it } from "bun:test";

import { HIDDEN_TOOL_NAMES } from "@/lib/mcp/constants";

import { DEDUPED_CARD_TOOLS } from "./chat-console";

describe("tool visibility tiers", () => {
  describe("HIDDEN_TOOL_NAMES", () => {
    it("hides getFleetOverview (data feeds AI summary, not a user-facing card)", () => {
      expect(HIDDEN_TOOL_NAMES.has("getFleetOverview")).toBe(true);
    });

    it("hides searchKnowledge (already rendered in Sources section)", () => {
      expect(HIDDEN_TOOL_NAMES.has("searchKnowledge")).toBe(true);
    });

    it("hides debugAuth (internal diagnostic)", () => {
      expect(HIDDEN_TOOL_NAMES.has("debugAuth")).toBe(true);
    });

    it("hides suggestActions (rendered as ActionButtons)", () => {
      expect(HIDDEN_TOOL_NAMES.has("suggestActions")).toBe(true);
    });

    it("does not hide tools that have rich cards", () => {
      for (const tool of DEDUPED_CARD_TOOLS) {
        expect(HIDDEN_TOOL_NAMES.has(tool)).toBe(false);
      }
    });
  });

  describe("DEDUPED_CARD_TOOLS", () => {
    it("includes data-fetching tools that should be deduped within a message", () => {
      expect(DEDUPED_CARD_TOOLS.size).toBe(4);
      expect(DEDUPED_CARD_TOOLS.has("getChromeEvents")).toBe(true);
      expect(DEDUPED_CARD_TOOLS.has("getChromeConnectorConfiguration")).toBe(
        true
      );
      expect(DEDUPED_CARD_TOOLS.has("listDLPRules")).toBe(true);
      expect(DEDUPED_CARD_TOOLS.has("listOrgUnits")).toBe(true);
    });

    it("does not include action tools that may be called multiple times with unique results", () => {
      expect(DEDUPED_CARD_TOOLS.has("draftPolicyChange")).toBe(false);
      expect(DEDUPED_CARD_TOOLS.has("createDLPRule")).toBe(false);
      expect(DEDUPED_CARD_TOOLS.has("applyPolicyChange")).toBe(false);
    });
  });

  describe("no tool is in both sets", () => {
    it("HIDDEN_TOOL_NAMES and DEDUPED_CARD_TOOLS are disjoint", () => {
      for (const tool of HIDDEN_TOOL_NAMES) {
        expect(DEDUPED_CARD_TOOLS.has(tool)).toBe(false);
      }
    });
  });

  describe("deduplication logic", () => {
    it("lastToolIndex map keeps only the last index per data-fetching tool name", () => {
      const parts = [
        { toolName: "listDLPRules", index: 0 },
        { toolName: "draftPolicyChange", index: 1 },
        { toolName: "listDLPRules", index: 2 },
        { toolName: "draftPolicyChange", index: 3 },
      ];

      const lastToolIndex = new Map<string, number>();
      for (const p of parts) {
        if (DEDUPED_CARD_TOOLS.has(p.toolName)) {
          lastToolIndex.set(p.toolName, p.index);
        }
      }

      expect(lastToolIndex.get("listDLPRules")).toBe(2);
      expect(lastToolIndex.has("draftPolicyChange")).toBe(false);
    });

    it("earlier invocations of data-fetching tools are suppressed", () => {
      const lastToolIndex = new Map<string, number>([["listDLPRules", 2]]);

      const shouldShow0 = lastToolIndex.get("listDLPRules") === 0;
      expect(shouldShow0).toBe(false);

      const shouldShow2 = lastToolIndex.get("listDLPRules") === 2;
      expect(shouldShow2).toBe(true);
    });

    it("does not deduplicate tools outside DEDUPED_CARD_TOOLS", () => {
      const parts = [
        { toolName: "enrollBrowser", index: 0 },
        { toolName: "enrollBrowser", index: 1 },
      ];

      const lastToolIndex = new Map<string, number>();
      for (const p of parts) {
        if (DEDUPED_CARD_TOOLS.has(p.toolName)) {
          lastToolIndex.set(p.toolName, p.index);
        }
      }

      expect(lastToolIndex.has("enrollBrowser")).toBe(false);
    });
  });
});
