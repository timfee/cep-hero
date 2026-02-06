/**
 * Tests for generateWelcomeMessage.
 * Guards against the chat seed message duplicating dashboard text.
 */

import { describe, expect, it } from "bun:test";

import type { OverviewData } from "@/lib/overview";

import { generateWelcomeMessage } from "./welcome-message";

/**
 * Helper to build a minimal OverviewData fixture.
 */
function makeOverview(overrides: Partial<OverviewData> = {}): OverviewData {
  return {
    headline: "Welcome back — here's a quick fleet check-in.",
    summary:
      "Here's a quick check-in based on your fleet data. I can help you address the items below.",
    postureCards: [],
    suggestions: [],
    sources: [],
    ...overrides,
  };
}

describe("generateWelcomeMessage", () => {
  it("returns a greeting when no data is available", () => {
    const msg = generateWelcomeMessage(null);

    expect(msg).toContain("Chrome Enterprise Premium assistant");
    expect(msg).toContain("Ask me anything");
  });

  it("returns a greeting when data has no posture issues", () => {
    const msg = generateWelcomeMessage(makeOverview());

    expect(msg).toContain("Chrome Enterprise Premium assistant");
    expect(msg).toContain("looking good");
  });

  it("mentions specific gap areas when posture cards have issues", () => {
    const data = makeOverview({
      postureCards: [
        {
          label: "Data Protection Rules",
          value: "Not configured",
          note: "No rules",
          source: "Cloud Identity",
          action: "List DLP rules",
          status: "critical",
          priority: 1,
        },
        {
          label: "Connector Policies",
          value: "Not configured",
          note: "No connectors",
          source: "Chrome Policy",
          action: "Review connectors",
          status: "critical",
          priority: 2,
        },
      ],
    });

    const msg = generateWelcomeMessage(data);

    expect(msg).toContain("data protection rules");
    expect(msg).toContain("connector policies");
    expect(msg).toContain("attention");
  });

  it("only mentions cards with critical or warning status", () => {
    const data = makeOverview({
      postureCards: [
        {
          label: "Security Events",
          value: "42 events",
          note: "Active",
          source: "Admin SDK",
          action: "Show events",
          status: "healthy",
          priority: 3,
        },
        {
          label: "Data Protection Rules",
          value: "Not configured",
          note: "No rules",
          source: "Cloud Identity",
          action: "List DLP rules",
          status: "critical",
          priority: 1,
        },
      ],
    });

    const msg = generateWelcomeMessage(data);

    expect(msg).toContain("data protection rules");
    expect(msg).not.toContain("security events");
  });

  describe("never duplicates dashboard text", () => {
    const headlines = [
      "Welcome back — here's a quick fleet check-in.",
      "Quick fleet highlights are ready for your review.",
      "Welcome back — DLP rules still need attention.",
      "Welcome back — a couple security gaps are worth tightening up.",
      "Fleet posture",
    ];

    const summaries = [
      "Here's a quick check-in based on your fleet data. I can help you address the items below.",
      "Your fleet has 50 DLP rules configured and 120 security events in the last 7 days.",
      "I can guide you through setting up data protection rules and connector policies.",
    ];

    for (const headline of headlines) {
      it(`never returns the headline verbatim: "${headline.slice(0, 40)}..."`, () => {
        const data = makeOverview({ headline });
        const msg = generateWelcomeMessage(data);

        expect(msg).not.toBe(headline);
        expect(msg).not.toContain(headline);
      });
    }

    for (const summary of summaries) {
      it(`never returns the summary verbatim: "${summary.slice(0, 40)}..."`, () => {
        const data = makeOverview({ summary });
        const msg = generateWelcomeMessage(data);

        expect(msg).not.toBe(summary);
        expect(msg).not.toContain(summary);
      });
    }

    it("never equals headline even with posture gaps", () => {
      const data = makeOverview({
        headline: "Welcome back — DLP rules still need attention.",
        postureCards: [
          {
            label: "DLP Coverage",
            value: "0",
            note: "Not configured",
            source: "Cloud Identity",
            action: "Create DLP rule",
            status: "critical",
            priority: 1,
          },
        ],
      });

      const msg = generateWelcomeMessage(data);

      expect(msg).not.toBe(data.headline);
      expect(msg).not.toContain(data.headline);
    });
  });

  it("always starts with the assistant introduction", () => {
    const cases: Array<OverviewData | null> = [
      null,
      makeOverview(),
      makeOverview({
        postureCards: [
          {
            label: "Events",
            value: "0",
            note: "",
            source: "",
            action: "",
            status: "warning",
            priority: 1,
          },
        ],
      }),
    ];

    for (const input of cases) {
      const msg = generateWelcomeMessage(input);

      expect(msg).toMatch(/^Hey there!/);
      expect(msg).toContain("Chrome Enterprise Premium assistant");
    }
  });
});
