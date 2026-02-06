/**
 * Unit tests for fleet overview extraction and fallback summarization.
 * Tests the deterministic paths (no AI calls) for full coverage.
 */

import { describe, expect, it } from "bun:test";

import type { FleetOverviewFacts } from "./types";

import { extractFleetOverviewFacts } from "./extract";
import { buildFallbackOverview, enforceCardStyles } from "./summarize";

describe("extractFleetOverviewFacts", () => {
  const windowStart = new Date("2026-01-01T00:00:00Z");
  const windowEnd = new Date("2026-01-08T00:00:00Z");

  it("counts events, DLP rules, and connector policies", () => {
    const facts = extractFleetOverviewFacts(
      {
        events: { events: [{}, {}, {}] },
        totalCount: 3,
        sampled: false,
        windowStart,
        windowEnd,
      },
      { rules: [{}, {}] },
      { value: [{}] }
    );

    expect(facts.eventCount).toBe(3);
    expect(facts.dlpRuleCount).toBe(2);
    expect(facts.connectorPolicyCount).toBe(1);
  });

  it("handles empty results", () => {
    const facts = extractFleetOverviewFacts(
      {
        events: { events: [] },
        totalCount: 0,
        sampled: false,
        windowStart,
        windowEnd,
      },
      {},
      {}
    );

    expect(facts.eventCount).toBe(0);
    expect(facts.dlpRuleCount).toBe(0);
    expect(facts.connectorPolicyCount).toBe(0);
    expect(facts.latestEventAt).toBeNull();
    expect(facts.errors).toEqual([]);
  });

  it("detects blocked events", () => {
    const blockedEvent = {
      events: [
        {
          type: "DLP_VIOLATION",
          parameters: [{ name: "EVENT_RESULT", value: "BLOCKED" }],
        },
      ],
    };

    const facts = extractFleetOverviewFacts(
      {
        events: { events: [blockedEvent] },
        totalCount: 1,
        sampled: false,
        windowStart,
        windowEnd,
      },
      {},
      {}
    );

    expect(facts.blockedEventCount).toBe(1);
    expect(facts.errorEventCount).toBe(1);
  });

  it("extracts latest event timestamp", () => {
    const event = { id: { time: "2026-01-07T12:00:00Z" }, events: [] };

    const facts = extractFleetOverviewFacts(
      {
        events: { events: [event] },
        totalCount: 1,
        sampled: false,
        windowStart,
        windowEnd,
      },
      {},
      {}
    );

    expect(facts.latestEventAt).toBe("2026-01-07T12:00:00Z");
  });

  it("calculates window label in days", () => {
    const facts = extractFleetOverviewFacts(
      {
        events: { events: [] },
        totalCount: 0,
        sampled: false,
        windowStart,
        windowEnd,
      },
      {},
      {}
    );

    expect(facts.eventWindowLabel).toBe("7 days");
  });

  it("collects API errors from all sources", () => {
    const facts = extractFleetOverviewFacts(
      {
        events: { events: [], error: "Auth failed" },
        totalCount: 0,
        sampled: false,
        windowStart,
        windowEnd,
      },
      { error: "DLP unavailable" },
      { error: "Connector timeout" }
    );

    expect(facts.errors).toHaveLength(3);
    expect(facts.errors[0]).toContain("Auth failed");
    expect(facts.errors[1]).toContain("DLP unavailable");
    expect(facts.errors[2]).toContain("Connector timeout");
  });

  it("tracks sampled flag", () => {
    const facts = extractFleetOverviewFacts(
      {
        events: { events: [{}, {}] },
        totalCount: 500,
        sampled: true,
        windowStart,
        windowEnd,
      },
      {},
      {}
    );

    expect(facts.eventSampled).toBe(true);
    expect(facts.eventSampleCount).toBe(2);
    expect(facts.eventCount).toBe(500);
  });
});

describe("buildFallbackOverview", () => {
  it("builds critical cards when DLP and connectors are missing", () => {
    const result = buildFallbackOverview({
      eventCount: 0,
      blockedEventCount: 0,
      errorEventCount: 0,
      dlpRuleCount: 0,
      connectorPolicyCount: 0,
      latestEventAt: null,
      eventWindowLabel: "7 days",
      eventSampled: false,
      eventSampleCount: 0,
      errors: [],
    });

    expect(result.headline).toContain("security gaps");
    expect(result.postureCards).toHaveLength(3);

    const dlpCard = result.postureCards.find(
      (c) => c.label === "Data Protection Rules"
    );
    expect(dlpCard?.status).toBe("critical");
    expect(dlpCard?.value).toBe("Not configured");

    const connCard = result.postureCards.find(
      (c) => c.label === "Connector Policies"
    );
    expect(connCard?.status).toBe("critical");
  });

  it("builds healthy cards when everything is configured", () => {
    const result = buildFallbackOverview({
      eventCount: 100,
      blockedEventCount: 5,
      errorEventCount: 2,
      dlpRuleCount: 3,
      connectorPolicyCount: 2,
      latestEventAt: "2026-01-07T12:00:00Z",
      eventWindowLabel: "7 days",
      eventSampled: false,
      eventSampleCount: 100,
      errors: [],
    });

    expect(result.headline).toContain("check-in");

    const dlpCard = result.postureCards.find(
      (c) => c.label === "Data Protection Rules"
    );
    expect(dlpCard?.status).toBe("healthy");
    expect(dlpCard?.value).toBe("3 rules");

    const eventCard = result.postureCards.find(
      (c) => c.label === "Security Events"
    );
    expect(eventCard?.status).toBe("healthy");
    expect(eventCard?.value).toContain("100 events");
    expect(eventCard?.value).toContain("5 blocked");
  });

  it("suggests DLP setup when no rules exist", () => {
    const result = buildFallbackOverview({
      eventCount: 10,
      blockedEventCount: 0,
      errorEventCount: 0,
      dlpRuleCount: 0,
      connectorPolicyCount: 1,
      latestEventAt: null,
      eventWindowLabel: "7 days",
      eventSampled: false,
      eventSampleCount: 10,
      errors: [],
    });

    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0].category).toBe("security");
    expect(result.suggestions[0].text).toBe("Create a DLP rule");
  });

  it("includes correct API sources", () => {
    const result = buildFallbackOverview({
      eventCount: 0,
      blockedEventCount: 0,
      errorEventCount: 0,
      dlpRuleCount: 0,
      connectorPolicyCount: 0,
      latestEventAt: null,
      eventWindowLabel: "7 days",
      eventSampled: false,
      eventSampleCount: 0,
      errors: [],
    });

    expect(result.sources).toContain("Admin SDK Reports");
    expect(result.sources).toContain("Cloud Identity");
    expect(result.sources).toContain("Chrome Policy");
  });

  it("shows sampled event counts correctly", () => {
    const result = buildFallbackOverview({
      eventCount: 500,
      blockedEventCount: 10,
      errorEventCount: 5,
      dlpRuleCount: 1,
      connectorPolicyCount: 1,
      latestEventAt: "2026-01-07T12:00:00Z",
      eventWindowLabel: "7 days",
      eventSampled: true,
      eventSampleCount: 50,
      errors: [],
    });

    const eventCard = result.postureCards.find(
      (c) => c.label === "Security Events"
    );
    expect(eventCard?.value).toContain("500+");
    expect(eventCard?.value).toContain("sampled");
  });
});

describe("enforceCardStyles", () => {
  const baseFacts: FleetOverviewFacts = {
    eventCount: 0,
    blockedEventCount: 0,
    errorEventCount: 0,
    dlpRuleCount: 0,
    connectorPolicyCount: 0,
    latestEventAt: null,
    eventWindowLabel: "7 days",
    eventSampled: false,
    eventSampleCount: 0,
    errors: [],
  };

  const baseOverview = {
    headline: "Test",
    summary: "Test summary",
    postureCards: [] as {
      label: string;
      value: string;
      note: string;
      source: string;
      action: string;
      status?: "healthy" | "warning" | "critical" | "info";
    }[],
    suggestions: [] as {
      text: string;
      action: string;
      priority: number;
      category: "security" | "compliance" | "monitoring" | "optimization";
    }[],
    sources: ["Test"],
  };

  describe("posture card status enforcement", () => {
    it("marks DLP card critical when no rules exist", () => {
      const overview = {
        ...baseOverview,
        postureCards: [
          {
            label: "DLP Coverage",
            value: "0",
            note: "",
            source: "",
            action: "check dlp",
            status: "healthy" as const,
          },
        ],
      };

      const result = enforceCardStyles(overview, {
        ...baseFacts,
        dlpRuleCount: 0,
      });
      expect(result.postureCards[0].status).toBe("critical");
    });

    it("marks DLP card healthy when rules exist", () => {
      const overview = {
        ...baseOverview,
        postureCards: [
          {
            label: "Data Protection Rules",
            value: "5",
            note: "",
            source: "",
            action: "list rules",
            status: "critical" as const,
          },
        ],
      };

      const result = enforceCardStyles(overview, {
        ...baseFacts,
        dlpRuleCount: 5,
      });
      expect(result.postureCards[0].status).toBe("healthy");
    });

    it("matches 'Data Loss Prevention' label variant", () => {
      const overview = {
        ...baseOverview,
        postureCards: [
          {
            label: "Data Loss Prevention",
            value: "3",
            note: "",
            source: "",
            action: "list rules",
            status: "warning" as const,
          },
        ],
      };

      const result = enforceCardStyles(overview, {
        ...baseFacts,
        dlpRuleCount: 3,
      });
      expect(result.postureCards[0].status).toBe("healthy");
    });

    it("marks event card warning when no events exist", () => {
      const overview = {
        ...baseOverview,
        postureCards: [
          {
            label: "Security Events",
            value: "0",
            note: "",
            source: "",
            action: "show events",
            status: "healthy" as const,
          },
        ],
      };

      const result = enforceCardStyles(overview, {
        ...baseFacts,
        eventCount: 0,
      });
      expect(result.postureCards[0].status).toBe("warning");
    });

    it("marks event card healthy when events exist with no blocks", () => {
      const overview = {
        ...baseOverview,
        postureCards: [
          {
            label: "Event Monitoring",
            value: "50",
            note: "",
            source: "",
            action: "show events",
            status: "critical" as const,
          },
        ],
      };

      const result = enforceCardStyles(overview, {
        ...baseFacts,
        eventCount: 50,
        blockedEventCount: 0,
      });
      expect(result.postureCards[0].status).toBe("healthy");
    });

    it("marks event card warning when blocked events exist", () => {
      const overview = {
        ...baseOverview,
        postureCards: [
          {
            label: "Browser Activity",
            value: "50",
            note: "",
            source: "",
            action: "show events",
            status: "healthy" as const,
          },
        ],
      };

      const result = enforceCardStyles(overview, {
        ...baseFacts,
        eventCount: 50,
        blockedEventCount: 3,
      });
      expect(result.postureCards[0].status).toBe("warning");
    });

    it("marks connector card critical when not configured", () => {
      const overview = {
        ...baseOverview,
        postureCards: [
          {
            label: "Connector Status",
            value: "None",
            note: "",
            source: "",
            action: "check connectors",
            status: "info" as const,
          },
        ],
      };

      const result = enforceCardStyles(overview, {
        ...baseFacts,
        connectorPolicyCount: 0,
      });
      expect(result.postureCards[0].status).toBe("critical");
    });

    it("marks connector card healthy when configured", () => {
      const overview = {
        ...baseOverview,
        postureCards: [
          {
            label: "Connector Policies",
            value: "2",
            note: "",
            source: "",
            action: "check connectors",
            status: "critical" as const,
          },
        ],
      };

      const result = enforceCardStyles(overview, {
        ...baseFacts,
        connectorPolicyCount: 2,
      });
      expect(result.postureCards[0].status).toBe("healthy");
    });

    it("preserves AI-assigned status for unrecognized card labels", () => {
      const overview = {
        ...baseOverview,
        postureCards: [
          {
            label: "Browser Security",
            value: "OK",
            note: "",
            source: "",
            action: "check",
            status: "info" as const,
          },
        ],
      };

      const result = enforceCardStyles(overview, baseFacts);
      expect(result.postureCards[0].status).toBe("info");
    });

    it("handles cards with no status gracefully", () => {
      const overview = {
        ...baseOverview,
        postureCards: [
          {
            label: "Unknown Card",
            value: "OK",
            note: "",
            source: "",
            action: "check",
          },
        ],
      };

      const result = enforceCardStyles(overview, baseFacts);
      expect(result.postureCards[0].status).toBeUndefined();
    });
  });

  describe("suggestion category enforcement", () => {
    it("categorizes DLP suggestions as security", () => {
      const overview = {
        ...baseOverview,
        suggestions: [
          {
            text: "Set up a DLP rule to monitor traffic",
            action: "create dlp",
            priority: 1,
            category: "monitoring" as const,
          },
        ],
      };

      const result = enforceCardStyles(overview, baseFacts);
      expect(result.suggestions[0].category).toBe("security");
    });

    it("categorizes connector suggestions as security", () => {
      const overview = {
        ...baseOverview,
        suggestions: [
          {
            text: "Configure connector policies",
            action: "setup connectors",
            priority: 2,
            category: "optimization" as const,
          },
        ],
      };

      const result = enforceCardStyles(overview, baseFacts);
      expect(result.suggestions[0].category).toBe("security");
    });

    it("categorizes event reporting suggestions as monitoring", () => {
      const overview = {
        ...baseOverview,
        suggestions: [
          {
            text: "Enable event reporting for visibility",
            action: "enable events",
            priority: 3,
            category: "security" as const,
          },
        ],
      };

      const result = enforceCardStyles(overview, baseFacts);
      expect(result.suggestions[0].category).toBe("monitoring");
    });

    it("categorizes audit suggestions as compliance", () => {
      const overview = {
        ...baseOverview,
        suggestions: [
          {
            text: "Run a compliance audit",
            action: "audit",
            priority: 4,
            category: "security" as const,
          },
        ],
      };

      const result = enforceCardStyles(overview, baseFacts);
      expect(result.suggestions[0].category).toBe("compliance");
    });

    it("preserves AI-assigned category for unrecognized suggestion text", () => {
      const overview = {
        ...baseOverview,
        suggestions: [
          {
            text: "Optimize your fleet",
            action: "optimize",
            priority: 5,
            category: "optimization" as const,
          },
        ],
      };

      const result = enforceCardStyles(overview, baseFacts);
      expect(result.suggestions[0].category).toBe("optimization");
    });
  });

  describe("edge cases", () => {
    it("handles empty posture cards and suggestions", () => {
      const result = enforceCardStyles(baseOverview, baseFacts);

      expect(result.postureCards).toEqual([]);
      expect(result.suggestions).toEqual([]);
    });

    it("preserves non-style fields unchanged", () => {
      const overview = {
        ...baseOverview,
        headline: "My headline",
        summary: "My summary",
        postureCards: [
          {
            label: "DLP Coverage",
            value: "5 rules",
            note: "Active",
            source: "Cloud Identity",
            action: "list rules",
            status: "warning" as const,
          },
        ],
        suggestions: [
          {
            text: "Set up DLP rules",
            action: "create dlp",
            priority: 1,
            category: "monitoring" as const,
          },
        ],
        sources: ["Admin SDK", "Cloud Identity"],
      };

      const result = enforceCardStyles(overview, {
        ...baseFacts,
        dlpRuleCount: 5,
      });

      expect(result.headline).toBe("My headline");
      expect(result.summary).toBe("My summary");
      expect(result.sources).toEqual(["Admin SDK", "Cloud Identity"]);
      expect(result.postureCards[0].label).toBe("DLP Coverage");
      expect(result.postureCards[0].value).toBe("5 rules");
      expect(result.postureCards[0].note).toBe("Active");
      expect(result.suggestions[0].text).toBe("Set up DLP rules");
      expect(result.suggestions[0].action).toBe("create dlp");
      expect(result.suggestions[0].priority).toBe(1);
    });

    it("enforces multiple cards in a single overview", () => {
      const overview = {
        ...baseOverview,
        postureCards: [
          {
            label: "DLP Coverage",
            value: "0",
            note: "",
            source: "",
            action: "dlp",
            status: "healthy" as const,
          },
          {
            label: "Security Events",
            value: "100",
            note: "",
            source: "",
            action: "events",
            status: "critical" as const,
          },
          {
            label: "Connector Status",
            value: "2",
            note: "",
            source: "",
            action: "conn",
            status: "info" as const,
          },
          {
            label: "Browser Security",
            value: "OK",
            note: "",
            source: "",
            action: "browser",
            status: "info" as const,
          },
        ],
      };

      const facts = {
        ...baseFacts,
        dlpRuleCount: 0,
        eventCount: 100,
        blockedEventCount: 0,
        connectorPolicyCount: 2,
      };

      const result = enforceCardStyles(overview, facts);

      expect(result.postureCards[0].status).toBe("critical");
      expect(result.postureCards[1].status).toBe("healthy");
      expect(result.postureCards[2].status).toBe("healthy");
      expect(result.postureCards[3].status).toBe("info");
    });
  });
});
