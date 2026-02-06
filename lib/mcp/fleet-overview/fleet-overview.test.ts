/**
 * Unit tests for fleet overview extraction and fallback summarization.
 * Tests the deterministic paths (no AI calls) for full coverage.
 */

import { describe, expect, it } from "bun:test";

import { extractFleetOverviewFacts } from "./extract";
import { buildFallbackOverview } from "./summarize";

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
