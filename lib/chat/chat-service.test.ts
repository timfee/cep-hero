/**
 * Unit tests for chat-service orchestration functions.
 * Tests guard shapes, analyzeLastStep, and stopWhen behavior.
 */

import { describe, expect, it } from "bun:test";

import {
  analyzeLastStep,
  buildActionCompletionGuard,
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

    it("buildActionCompletionGuard returns system only", () => {
      const result = buildActionCompletionGuard(basePrompt);

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
      expect(result.hasSuggestActionsCall).toBe(false);
    });

    it("detects suggestActions call", () => {
      const result = analyzeLastStep({
        toolResults: [{ data: "something" }],
        text: "Here is what I found in the diagnostic logs.",
        toolCalls: [{ toolName: "suggestActions" }],
      });

      expect(result.hasSuggestActionsCall).toBe(true);
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
      expect(result).toHaveProperty("hasSuggestActionsCall");
      expect(result).toHaveProperty("hasShortResponse");
      expect(result).toHaveProperty("textLength");
    });
  });

  describe("computeStepResponse", () => {
    it("returns response completion guard when tool results but no text", () => {
      const result = computeStepResponse(
        {
          hasToolResults: true,
          hasText: false,
          hasSuggestActionsCall: false,
          hasShortResponse: false,
          textLength: 0,
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
          hasSuggestActionsCall: false,
          hasShortResponse: true,
          textLength: 10,
        },
        basePrompt
      );

      expect(result).toHaveProperty("system");
      expect(result.system as string).toContain("brief");
    });

    it("returns action completion guard when missing suggestActions", () => {
      const result = computeStepResponse(
        {
          hasToolResults: true,
          hasText: true,
          hasSuggestActionsCall: false,
          hasShortResponse: false,
          textLength: 100,
        },
        basePrompt
      );

      expect(result).toHaveProperty("system");
      expect(result.system as string).toContain("suggestActions");
    });

    it("returns empty object when response is complete", () => {
      const result = computeStepResponse(
        {
          hasToolResults: true,
          hasText: true,
          hasSuggestActionsCall: true,
          hasShortResponse: false,
          textLength: 100,
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
          hasSuggestActionsCall: false,
          hasShortResponse: false,
          textLength: 0,
        },
        basePrompt
      );

      expect(result).toEqual({});
    });
  });
});
