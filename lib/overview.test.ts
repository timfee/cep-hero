/**
 * Tests for overview data sanitization and normalization.
 * Guards against malformed AI-generated text reaching the UI.
 */

import { describe, expect, it } from "bun:test";

import { normalizeOverview } from "./overview";

/**
 * Helper to build a minimal valid raw overview object.
 */
function makeRaw(overrides: Record<string, unknown> = {}) {
  return {
    headline: "Fleet check-in",
    summary: "All good.",
    postureCards: [],
    suggestions: [],
    sources: [],
    ...overrides,
  };
}

describe("normalizeOverview", () => {
  describe("summary sanitization", () => {
    it("strips a leading period from the summary", () => {
      const result = normalizeOverview(
        makeRaw({ summary: ". I can guide you through setting up DLP rules." })
      );

      expect(result?.summary).toBe(
        "I can guide you through setting up DLP rules."
      );
    });

    it("strips multiple leading punctuation characters", () => {
      const result = normalizeOverview(
        makeRaw({ summary: "., ; Here is your summary." })
      );

      expect(result?.summary).toBe("Here is your summary.");
    });

    it("strips leading whitespace and punctuation together", () => {
      const result = normalizeOverview(
        makeRaw({ summary: "  . Some text here." })
      );

      expect(result?.summary).toBe("Some text here.");
    });

    it("leaves a clean summary unchanged", () => {
      const result = normalizeOverview(
        makeRaw({
          summary: "Your fleet has 50 DLP rules and 120 events.",
        })
      );

      expect(result?.summary).toBe(
        "Your fleet has 50 DLP rules and 120 events."
      );
    });

    it("handles an empty summary", () => {
      const result = normalizeOverview(makeRaw({ summary: "" }));

      expect(result?.summary).toBe("");
    });

    it("strips leading exclamation and question marks", () => {
      const result = normalizeOverview(
        makeRaw({ summary: "!? Something happened." })
      );

      expect(result?.summary).toBe("Something happened.");
    });
  });

  describe("headline sanitization", () => {
    it("does not strip leading punctuation from headlines", () => {
      // Headlines use sanitizeHeadline which only redacts + trims,
      // not the punctuation stripping from sanitizeOverviewText
      const result = normalizeOverview(
        makeRaw({ headline: "Welcome back — check-in time." })
      );

      expect(result?.headline).toBe("Welcome back — check-in time.");
    });
  });

  describe("validation", () => {
    it("returns null for non-object input", () => {
      expect(normalizeOverview(null)).toBeNull();
      expect(normalizeOverview("string")).toBeNull();
      expect(normalizeOverview(42)).toBeNull();
    });

    it("provides default headline when missing", () => {
      const result = normalizeOverview(makeRaw({ headline: undefined }));

      expect(result?.headline).toBe("Fleet posture");
    });

    it("filters out invalid posture cards", () => {
      const result = normalizeOverview(
        makeRaw({
          postureCards: [
            {
              label: "Valid",
              value: "OK",
              note: "Fine",
              source: "API",
              action: "check",
            },
            { label: "Missing value" },
            "not an object",
          ],
        })
      );

      expect(result?.postureCards).toHaveLength(1);
      expect(result?.postureCards[0].label).toBe("Valid");
    });

    it("filters out invalid suggestions", () => {
      const result = normalizeOverview(
        makeRaw({
          suggestions: [
            {
              text: "Do something",
              action: "do it",
              priority: 1,
              category: "security",
            },
            {
              text: "Bad",
              action: "bad",
              priority: 1,
              category: "invalid-category",
            },
            "not an object",
          ],
        })
      );

      expect(result?.suggestions).toHaveLength(1);
      expect(result?.suggestions[0].text).toBe("Do something");
    });
  });
});
