/**
 * Unit tests for organizational unit resolution utilities.
 * Covers normalizeResource, buildOrgUnitNameMap, resolveOrgUnitDisplay,
 * and buildOrgUnitTargetResource with inline fixture data.
 */

import { describe, expect, it } from "bun:test";

import {
  buildOrgUnitNameMap,
  buildOrgUnitTargetResource,
  leafName,
  normalizeResource,
  type OrgUnit,
  resolveOrgUnitDisplay,
  sanitizeOrgUnitIds,
} from "./org-units";

/**
 * Sample org unit fixtures matching the structure from evals/fixtures/base.
 */
const SAMPLE_ORG_UNITS: OrgUnit[] = [
  {
    orgUnitId: "id:03ph8a2z221pcso",
    orgUnitPath: "/Engineering-Test",
    name: "Engineering-Test",
    parentOrgUnitId: "id:03ph8a2z23yjui6",
  },
  {
    orgUnitId: "id:03ph8a2z23yjui6",
    orgUnitPath: "/",
    name: "Root",
    parentOrgUnitId: null,
  },
  {
    orgUnitId: "id:03ph8a2z2mu9l06",
    orgUnitPath: "/Web-Off",
    name: "Web-Off",
    parentOrgUnitId: "id:03ph8a2z23yjui6",
  },
];

describe("normalizeResource", () => {
  it("strips id: prefix", () => {
    expect(normalizeResource("id:03ph8a2z221pcso")).toBe("03ph8a2z221pcso");
  });

  it("collapses duplicate slashes", () => {
    expect(normalizeResource("orgunits//abc")).toBe("orgunits/abc");
    expect(normalizeResource("orgunits///abc//def")).toBe("orgunits/abc/def");
  });

  it("lowercases Orgunits prefix", () => {
    expect(normalizeResource("Orgunits/abc")).toBe("orgunits/abc");
    expect(normalizeResource("ORGUNITS/abc")).toBe("orgunits/abc");
  });

  it("lowercases Customers prefix", () => {
    expect(normalizeResource("Customers/C12345")).toBe("customers/C12345");
    expect(normalizeResource("CUSTOMERS/C12345")).toBe("customers/C12345");
  });

  it("trims whitespace", () => {
    expect(normalizeResource("  orgunits/abc  ")).toBe("orgunits/abc");
  });

  it("handles combined normalizations", () => {
    expect(normalizeResource("  id:Orgunits//abc  ")).toBe("orgunits/abc");
  });
});

describe("buildOrgUnitNameMap", () => {
  it("builds lookup map from org units", () => {
    const map = buildOrgUnitNameMap(SAMPLE_ORG_UNITS);

    expect(map.size).toBeGreaterThan(0);
  });

  it("indexes by normalized ID", () => {
    const map = buildOrgUnitNameMap(SAMPLE_ORG_UNITS);

    expect(map.get("03ph8a2z221pcso")).toBe("/Engineering-Test");
  });

  it("indexes by orgunits/ prefixed ID", () => {
    const map = buildOrgUnitNameMap(SAMPLE_ORG_UNITS);

    expect(map.get("orgunits/03ph8a2z221pcso")).toBe("/Engineering-Test");
  });

  it("indexes by id: prefixed ID", () => {
    const map = buildOrgUnitNameMap(SAMPLE_ORG_UNITS);

    expect(map.get("id:03ph8a2z221pcso")).toBe("/Engineering-Test");
  });

  it("uses orgUnitPath as display name", () => {
    const map = buildOrgUnitNameMap(SAMPLE_ORG_UNITS);

    expect(map.get("03ph8a2z2mu9l06")).toBe("/Web-Off");
  });

  it("skips units with missing path and name", () => {
    const units: OrgUnit[] = [
      { orgUnitId: "id:abc", orgUnitPath: null, name: null },
    ];
    const map = buildOrgUnitNameMap(units);

    expect(map.size).toBe(0);
  });

  it("skips units with missing orgUnitId", () => {
    const units: OrgUnit[] = [
      { orgUnitId: null, orgUnitPath: "/Test", name: "Test" },
    ];
    const map = buildOrgUnitNameMap(units);

    expect(map.size).toBe(0);
  });

  it("falls back to name when orgUnitPath is missing", () => {
    const units: OrgUnit[] = [
      { orgUnitId: "id:abc123", orgUnitPath: null, name: "FallbackName" },
    ];
    const map = buildOrgUnitNameMap(units);

    expect(map.get("abc123")).toBe("FallbackName");
  });
});

describe("resolveOrgUnitDisplay", () => {
  const map = buildOrgUnitNameMap(SAMPLE_ORG_UNITS);
  const rootOrgUnitId = "id:03ph8a2z23yjui6";
  const rootOrgUnitPath = "/";

  it("returns null for null input", () => {
    expect(resolveOrgUnitDisplay(null, map, null, null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(resolveOrgUnitDisplay(undefined, map, null, null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(resolveOrgUnitDisplay("", map, null, null)).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(resolveOrgUnitDisplay("   ", map, null, null)).toBeNull();
  });

  it("returns path directly for values starting with /", () => {
    expect(resolveOrgUnitDisplay("/Engineering", map, null, null)).toBe(
      "/Engineering"
    );
  });

  it("resolves org unit ID through map lookup", () => {
    expect(
      resolveOrgUnitDisplay("orgunits/03ph8a2z221pcso", map, null, null)
    ).toBe("/Engineering-Test");
  });

  it("resolves root org unit via special matching with friendly label", () => {
    expect(
      resolveOrgUnitDisplay(
        "orgunits/03ph8a2z23yjui6",
        map,
        rootOrgUnitId,
        rootOrgUnitPath
      )
    ).toBe("/ (Root)");
  });

  it("returns null for unknown ID", () => {
    expect(
      resolveOrgUnitDisplay("orgunits/nonexistent", map, null, null)
    ).toBeNull();
  });
});

describe("buildOrgUnitTargetResource", () => {
  it("returns empty string for empty input", () => {
    expect(buildOrgUnitTargetResource("")).toBe("");
  });

  it("returns empty string for just slash", () => {
    expect(buildOrgUnitTargetResource("/")).toBe("");
  });

  it("returns empty string for orgunits/ without ID", () => {
    expect(buildOrgUnitTargetResource("orgunits/")).toBe("");
  });

  it("returns empty string for customers/ without ID", () => {
    expect(buildOrgUnitTargetResource("customers/")).toBe("");
  });

  it("preserves valid orgunits/ID format", () => {
    expect(buildOrgUnitTargetResource("orgunits/03ph8a2z23yjui6")).toBe(
      "orgunits/03ph8a2z23yjui6"
    );
  });

  it("rejects customers/ prefixed values", () => {
    expect(buildOrgUnitTargetResource("customers/C12345")).toBe("");
  });

  it("prefixes bare ID with orgunits/", () => {
    expect(buildOrgUnitTargetResource("03ph8a2z23yjui6")).toBe(
      "orgunits/03ph8a2z23yjui6"
    );
  });

  it("converts path starting with / to orgunits/ format", () => {
    expect(buildOrgUnitTargetResource("/Engineering")).toBe(
      "orgunits/Engineering"
    );
  });

  it("normalizes case for prefix", () => {
    expect(buildOrgUnitTargetResource("Orgunits/abc")).toBe("orgunits/abc");
  });
});

describe("leafName", () => {
  it("extracts leaf from multi-segment path", () => {
    expect(leafName("/Sales/West Coast")).toBe("West Coast");
  });

  it("extracts leaf from single-segment path", () => {
    expect(leafName("/Engineering")).toBe("Engineering");
  });

  it("returns / for root path", () => {
    expect(leafName("/")).toBe("/");
  });

  it("returns / for empty string", () => {
    expect(leafName("")).toBe("/");
  });

  it("extracts leaf from deep path", () => {
    expect(leafName("/Org/Sales/West Coast/Team A")).toBe("Team A");
  });
});

describe("sanitizeOrgUnitIds", () => {
  const pathMap = new Map<string, { path: string }>([
    ["orgunits/abc123", { path: "/Engineering" }],
    ["abc123", { path: "/Engineering" }],
    ["orgunits/xyz789", { path: "/Sales/West Coast" }],
    ["xyz789", { path: "/Sales/West Coast" }],
    ["orgunits/org_unit_123", { path: "/With Underscores" }],
    ["org_unit_123", { path: "/With Underscores" }],
  ]);

  it("replaces orgunits/ prefixed IDs with paths", () => {
    const input = '{"targetResource": "orgunits/abc123"}';
    const result = sanitizeOrgUnitIds(input, pathMap);
    expect(result).toBe('{"targetResource": "/Engineering"}');
  });

  it("replaces id: prefixed IDs with paths", () => {
    const input = '{"orgUnit": "id:abc123"}';
    const result = sanitizeOrgUnitIds(input, pathMap);
    expect(result).toBe('{"orgUnit": "/Engineering"}');
  });

  it("replaces multiple occurrences in same string", () => {
    const input = "orgunits/abc123 and orgunits/xyz789";
    const result = sanitizeOrgUnitIds(input, pathMap);
    expect(result).toBe("/Engineering and /Sales/West Coast");
  });

  it("leaves unrecognized IDs unchanged", () => {
    const input = '{"targetResource": "orgunits/unknown999"}';
    const result = sanitizeOrgUnitIds(input, pathMap);
    expect(result).toBe('{"targetResource": "orgunits/unknown999"}');
  });

  it("handles IDs with underscores", () => {
    const input = '{"orgUnit": "orgunits/org_unit_123"}';
    const result = sanitizeOrgUnitIds(input, pathMap);
    expect(result).toBe('{"orgUnit": "/With Underscores"}');
  });

  it("returns input unchanged when map is empty", () => {
    const input = '{"targetResource": "orgunits/abc123"}';
    const result = sanitizeOrgUnitIds(input, new Map());
    expect(result).toBe(input);
  });

  it("does not match bare IDs without prefix", () => {
    const input = '{"value": "abc123"}';
    const result = sanitizeOrgUnitIds(input, pathMap);
    expect(result).toBe('{"value": "abc123"}');
  });

  it("is case-insensitive for orgunits prefix", () => {
    const input = '{"target": "Orgunits/abc123"}';
    const result = sanitizeOrgUnitIds(input, pathMap);
    expect(result).toBe('{"target": "/Engineering"}');
  });
});
