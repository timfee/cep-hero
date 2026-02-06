/**
 * Tests for overview data sanitization and normalization.
 * Guards against malformed AI-generated text reaching the UI.
 */

import { describe, expect, it } from "bun:test";

import {
  normalizeOverview,
  sanitizeOverview,
  type OverviewData,
} from "./overview";

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
        makeRaw({ summary: ".,;Here is your summary." })
      );

      expect(result?.summary).toBe("Here is your summary.");
    });

    it("strips leading punctuation then trims remaining whitespace", () => {
      const result = normalizeOverview(
        makeRaw({ summary: "... Some text here." })
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

/**
 * Helper to build a complete OverviewData object for sanitization tests.
 */
function makeOverviewData(overrides: Partial<OverviewData> = {}): OverviewData {
  return {
    headline: "Fleet check-in",
    summary: "All good.",
    postureCards: [],
    suggestions: [],
    sources: [],
    ...overrides,
  };
}

describe("sanitizeOverview", () => {
  describe("redacts emails from all text fields", () => {
    it("redacts emails in summary", () => {
      const data = makeOverviewData({
        summary: "Contact admin@company.com for help.",
      });

      const result = sanitizeOverview(data);

      expect(result.summary).not.toContain("admin@company.com");
      expect(result.summary).toContain("[redacted]");
    });

    it("redacts emails in headline", () => {
      const data = makeOverviewData({
        headline: "Alert for user@domain.org",
      });

      const result = sanitizeOverview(data);

      expect(result.headline).not.toContain("user@domain.org");
    });

    it("redacts emails in posture card fields", () => {
      const data = makeOverviewData({
        postureCards: [
          {
            label: "Contact owner@corp.com",
            value: "admin@corp.com configured",
            note: "Managed by ops@corp.com",
            source: "user@corp.com",
            action: "Email admin@corp.com",
          },
        ],
      });

      const result = sanitizeOverview(data);
      const card = result.postureCards[0];

      expect(card.label).not.toContain("@corp.com");
      expect(card.value).not.toContain("@corp.com");
      expect(card.note).not.toContain("@corp.com");
      expect(card.source).not.toContain("@corp.com");
      expect(card.action).not.toContain("@corp.com");
    });

    it("redacts emails in suggestions", () => {
      const data = makeOverviewData({
        suggestions: [
          {
            text: "Contact admin@company.com about DLP",
            action: "Email admin@company.com",
            priority: 1,
            category: "security",
          },
        ],
      });

      const result = sanitizeOverview(data);

      expect(result.suggestions[0].text).not.toContain("admin@company.com");
      expect(result.suggestions[0].action).not.toContain("admin@company.com");
    });
  });

  describe("redacts URLs from all text fields", () => {
    it("redacts HTTP URLs in summary", () => {
      const data = makeOverviewData({
        summary: "Visit https://admin.google.com/dashboard for details.",
      });

      const result = sanitizeOverview(data);

      expect(result.summary).not.toContain("https://admin.google.com");
    });

    it("redacts www URLs", () => {
      const data = makeOverviewData({
        summary: "See www.example.com/path for docs.",
      });

      const result = sanitizeOverview(data);

      expect(result.summary).not.toContain("www.example.com");
    });
  });

  describe("redacts domain names", () => {
    it("redacts real domain names in summary", () => {
      const data = makeOverviewData({
        summary: "The fleet is managed via admin.google.com portal.",
      });

      const result = sanitizeOverview(data);

      expect(result.summary).not.toContain("admin.google.com");
    });

    it("preserves allowed domains like example.com", () => {
      const data = makeOverviewData({
        summary: "Example: example.com is a test domain.",
      });

      const result = sanitizeOverview(data);

      expect(result.summary).toContain("example.com");
    });
  });

  it("redacts sources array entries", () => {
    const data = makeOverviewData({
      sources: ["https://admin.google.com/api", "admin@corp.com"],
    });

    const result = sanitizeOverview(data);

    for (const source of result.sources) {
      expect(source).not.toContain("admin.google.com");
      expect(source).not.toContain("admin@corp.com");
    }
  });
});
