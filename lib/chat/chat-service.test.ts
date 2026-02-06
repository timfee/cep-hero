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
    });
  });

  describe("computeStepResponse", () => {
    it("returns response completion guard when tool results but no text", () => {
      const result = computeStepResponse(
        {
          hasToolResults: true,
          hasText: false,
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
          hasShortResponse: true,
          textLength: 10,
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
          hasShortResponse: false,
          textLength: 0,
        },
        basePrompt
      );

      expect(result).toEqual({});
    });
  });
});
