/**
 * Unit tests for chat-service orchestration functions.
 * Tests guard shapes, analyzeLastStep, and stopWhen behavior.
 */

import { describe, expect, it } from "bun:test";

import {
  analyzeLastStep,
  buildResponseCompletionGuard,
  buildShortResponseGuard,
  computeStepResponse,
} from "./chat-service";

describe("chat-service", () => {
  const basePrompt = "You are CEP Hero.";

  describe("guard return shapes", () => {
    it("buildResponseCompletionGuard returns system only", () => {
      const result = buildResponseCompletionGuard(basePrompt);

      expect(result).toHaveProperty("system");
      expect(result).not.toHaveProperty("activeTools");
      expect(typeof result.system).toBe("string");
    });

    it("buildShortResponseGuard returns system only", () => {
      const result = buildShortResponseGuard(basePrompt);

      expect(result).toHaveProperty("system");
      expect(result).not.toHaveProperty("activeTools");
      expect(typeof result.system).toBe("string");
    });
  });

  describe("analyzeLastStep", () => {
    it("detects tool results with no text", () => {
      const result = analyzeLastStep({
        toolResults: [{ data: "something" }],
        text: "",
        toolCalls: [],
      });

      expect(result.hasToolResults).toBe(true);
      expect(result.hasText).toBe(false);
    });

    it("detects short response under 50 chars", () => {
      const result = analyzeLastStep({
        toolResults: [{ data: "something" }],
        text: "Short.",
        toolCalls: [],
      });

      expect(result.hasShortResponse).toBe(true);
      expect(result.textLength).toBeLessThan(50);
    });

    it("does not flag 50+ char response as short", () => {
      const longText =
        "This is a detailed response that explains the root cause.";

      const result = analyzeLastStep({
        toolResults: [{ data: "something" }],
        text: longText,
        toolCalls: [],
      });

      expect(result.hasShortResponse).toBe(false);
      expect(result.textLength).toBeGreaterThanOrEqual(50);
    });

    it("returns correct shape without DLP-specific fields", () => {
      const result = analyzeLastStep({
        toolResults: [],
        text: "test",
        toolCalls: [],
      });

      expect(result).not.toHaveProperty("hasDlpProposalCall");
      expect(result).not.toHaveProperty("recommendsDlpProposal");
      expect(result).toHaveProperty("hasToolResults");
      expect(result).toHaveProperty("hasText");
      expect(result).toHaveProperty("hasShortResponse");
      expect(result).toHaveProperty("textLength");
      expect(result).toHaveProperty("hasUIContent");
      expect(result).toHaveProperty("onlySilentTools");
    });

    it("detects only-silent-tools step", () => {
      const result = analyzeLastStep({
        toolResults: [{ actions: [] }],
        text: "Here is the diagnosis.",
        toolCalls: [{ toolName: "suggestActions" }],
      });

      expect(result.onlySilentTools).toBe(true);
      expect(result.hasToolResults).toBe(false);
    });

    it("does not flag mixed tool calls as only-silent", () => {
      const result = analyzeLastStep({
        toolResults: [{ events: [] }, { actions: [] }],
        text: "Here is the diagnosis.",
        toolCalls: [
          { toolName: "getChromeEvents" },
          { toolName: "suggestActions" },
        ],
      });

      expect(result.onlySilentTools).toBe(false);
      expect(result.hasToolResults).toBe(true);
    });

    it("detects ui.confirmation as UI content", () => {
      const result = analyzeLastStep({
        toolResults: [{ _type: "ui.confirmation", proposalId: "test-123" }],
        text: "",
        toolCalls: [],
      });
      expect(result.hasUIContent).toBe(true);
    });

    it("detects ui.success as UI content", () => {
      const result = analyzeLastStep({
        toolResults: [{ _type: "ui.success", ruleName: "DLP Rule" }],
        text: "",
        toolCalls: [],
      });
      expect(result.hasUIContent).toBe(true);
    });

    it("detects ui.manual_steps as UI content", () => {
      const result = analyzeLastStep({
        toolResults: [{ _type: "ui.manual_steps", steps: ["step 1"] }],
        text: "",
        toolCalls: [],
      });
      expect(result.hasUIContent).toBe(true);
    });

    it("detects ui.error as UI content", () => {
      const result = analyzeLastStep({
        toolResults: [{ _type: "ui.error", message: "API failure" }],
        text: "",
        toolCalls: [],
      });
      expect(result.hasUIContent).toBe(true);
    });

    it("does not flag regular tool results as UI content", () => {
      const result = analyzeLastStep({
        toolResults: [{ events: [], totalCount: 0 }],
        text: "",
        toolCalls: [],
      });
      expect(result.hasUIContent).toBe(false);
    });

    it("does not flag empty tool results as UI content", () => {
      const result = analyzeLastStep({
        toolResults: [],
        text: "some text",
        toolCalls: [],
      });
      expect(result.hasUIContent).toBe(false);
    });
  });

  describe("computeStepResponse", () => {
    it("returns response completion guard when tool results but no text", () => {
      const result = computeStepResponse(
        {
          hasToolResults: true,
          hasText: false,
          hasShortResponse: false,
          hasUIContent: false,
          textLength: 0,
          onlySilentTools: false,
        },
        basePrompt
      );

      expect(result).toHaveProperty("system");
      expect(result).not.toHaveProperty("activeTools");
    });

    it("returns short response guard when response is brief", () => {
      const result = computeStepResponse(
        {
          hasToolResults: true,
          hasText: true,
          hasShortResponse: true,
          hasUIContent: false,
          textLength: 10,
          onlySilentTools: false,
        },
        basePrompt
      );

      expect(result).toHaveProperty("system");
      expect(result.system as string).toContain("brief");
    });

    it("returns empty object when tool results and substantial text", () => {
      const result = computeStepResponse(
        {
          hasToolResults: true,
          hasText: true,
          hasShortResponse: false,
          hasUIContent: false,
          textLength: 100,
          onlySilentTools: false,
        },
        basePrompt
      );

      expect(result).toEqual({});
    });

    it("returns empty object when no tool results yet", () => {
      const result = computeStepResponse(
        {
          hasToolResults: false,
          hasText: false,
          hasShortResponse: false,
          hasUIContent: false,
          textLength: 0,
          onlySilentTools: false,
        },
        basePrompt
      );

      expect(result).toEqual({});
    });

    it("skips response completion guard when UI content is present", () => {
      const result = computeStepResponse(
        {
          hasToolResults: true,
          hasText: false,
          hasShortResponse: false,
          hasUIContent: true,
          textLength: 0,
          onlySilentTools: false,
        },
        basePrompt
      );
      expect(result).toEqual({});
    });

    it("skips short response guard when UI content is present", () => {
      const result = computeStepResponse(
        {
          hasToolResults: true,
          hasText: true,
          hasShortResponse: true,
          hasUIContent: true,
          textLength: 10,
          onlySilentTools: false,
        },
        basePrompt
      );
      expect(result).toEqual({});
    });

    it("stops generation when text exists and only silent tools ran", () => {
      const result = computeStepResponse(
        {
          hasToolResults: false,
          hasText: true,
          hasShortResponse: false,
          hasUIContent: false,
          textLength: 200,
          onlySilentTools: true,
        },
        basePrompt
      );

      expect(result).toHaveProperty("toolChoice", "none");
      expect(result).toHaveProperty("system");
      expect(result.system as string).toContain("already complete");
    });
  });
});
