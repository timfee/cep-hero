/**
 * Tests for org unit target resolution utilities.
 * Validates candidate building, deduplication, and root inference.
 */

import { describe, expect, it } from "bun:test";

import type { OrgUnit } from "@/lib/mcp/org-units";

import { resolveOrgUnitCandidates } from "./utils";

describe("resolveOrgUnitCandidates", () => {
  it("returns empty array for empty units list", () => {
    expect(resolveOrgUnitCandidates([])).toEqual([]);
  });

  it("infers root from first unit's parentOrgUnitId", () => {
    const units: OrgUnit[] = [
      {
        orgUnitId: "id:child1",
        orgUnitPath: "/Engineering",
        name: "Engineering",
        parentOrgUnitId: "id:root",
      },
    ];

    const candidates = resolveOrgUnitCandidates(units);

    // normalizeResource strips "id:" prefix -> "root"
    expect(candidates[0]).toBe("root");
  });

  it("falls back to first unit's orgUnitId when parent is null", () => {
    const units: OrgUnit[] = [
      {
        orgUnitId: "id:root",
        orgUnitPath: "/",
        name: "Root",
        parentOrgUnitId: null,
      },
    ];

    const candidates = resolveOrgUnitCandidates(units);

    expect(candidates[0]).toBe("root");
  });

  it("deduplicates root and child when they resolve to the same ID", () => {
    const units: OrgUnit[] = [
      {
        orgUnitId: "id:root",
        orgUnitPath: "/",
        name: "Root",
        parentOrgUnitId: null,
      },
    ];

    const candidates = resolveOrgUnitCandidates(units);
    const unique = new Set(candidates);

    expect(candidates.length).toBe(unique.size);
  });

  it("puts root candidate first, then child candidates", () => {
    const units: OrgUnit[] = [
      {
        orgUnitId: "id:child1",
        orgUnitPath: "/Engineering",
        name: "Engineering",
        parentOrgUnitId: "id:root",
      },
      {
        orgUnitId: "id:child2",
        orgUnitPath: "/Sales",
        name: "Sales",
        parentOrgUnitId: "id:root",
      },
    ];

    const candidates = resolveOrgUnitCandidates(units);

    expect(candidates[0]).toBe("root");
    expect(candidates).toContain("child1");
    expect(candidates).toContain("child2");
  });

  it("limits child candidates to first 3 units", () => {
    const units: OrgUnit[] = [
      {
        orgUnitId: "id:c1",
        orgUnitPath: "/A",
        name: "A",
        parentOrgUnitId: "id:root",
      },
      {
        orgUnitId: "id:c2",
        orgUnitPath: "/B",
        name: "B",
        parentOrgUnitId: "id:root",
      },
      {
        orgUnitId: "id:c3",
        orgUnitPath: "/C",
        name: "C",
        parentOrgUnitId: "id:root",
      },
      {
        orgUnitId: "id:c4",
        orgUnitPath: "/D",
        name: "D",
        parentOrgUnitId: "id:root",
      },
    ];

    const candidates = resolveOrgUnitCandidates(units);

    expect(candidates).toContain("c1");
    expect(candidates).toContain("c2");
    expect(candidates).toContain("c3");
    expect(candidates).not.toContain("c4");
  });

  it("preserves orgunits/ prefix from already-prefixed IDs", () => {
    const units: OrgUnit[] = [
      {
        orgUnitId: "orgunits/abc123",
        orgUnitPath: "/Test",
        name: "Test",
        parentOrgUnitId: "orgunits/root",
      },
    ];

    const candidates = resolveOrgUnitCandidates(units);

    expect(candidates[0]).toBe("orgunits/root");
    expect(candidates).toContain("orgunits/abc123");
  });

  it("skips units with empty orgUnitId", () => {
    const units: OrgUnit[] = [
      {
        orgUnitId: "id:c1",
        orgUnitPath: "/A",
        name: "A",
        parentOrgUnitId: "id:root",
      },
      {
        orgUnitId: "",
        orgUnitPath: "/B",
        name: "B",
        parentOrgUnitId: "id:root",
      },
    ];

    const candidates = resolveOrgUnitCandidates(units);

    // Empty ID should not appear
    expect(candidates).not.toContain("");
  });
});
