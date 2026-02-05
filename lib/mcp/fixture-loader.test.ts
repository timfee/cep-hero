/**
 * Unit tests for fixture data loading and merge logic.
 * Validates that base and override fixtures merge correctly with proper
 * type coercion for each FixtureData field.
 */

import { describe, expect, it } from "bun:test";

import { loadFixtureData } from "./fixture-loader";

describe("loadFixtureData", () => {
  describe("base-only loading", () => {
    it("returns base data when no override is provided", () => {
      const base = {
        orgUnits: [{ orgUnitId: "id:abc", orgUnitPath: "/Test" }],
      };

      const result = loadFixtureData(base);

      expect(result.orgUnits).toEqual([
        { orgUnitId: "id:abc", orgUnitPath: "/Test" },
      ]);
    });

    it("returns undefined for missing fields", () => {
      const result = loadFixtureData({});

      expect(result.orgUnits).toBeUndefined();
      expect(result.auditEvents).toBeUndefined();
      expect(result.dlpRules).toBeUndefined();
      expect(result.connectorPolicies).toBeUndefined();
      expect(result.policySchemas).toBeUndefined();
      expect(result.chromeReports).toBeUndefined();
      expect(result.enrollmentToken).toBeUndefined();
      expect(result.browsers).toBeUndefined();
      expect(result.errors).toBeUndefined();
    });
  });

  describe("type coercion", () => {
    it("validates orgUnits must be an array", () => {
      const base = { orgUnits: "not-an-array" };
      const result = loadFixtureData(base);

      expect(result.orgUnits).toBeUndefined();
    });

    it("validates dlpRules must be an array", () => {
      const base = { dlpRules: { rule: "not-array" } };
      const result = loadFixtureData(base);

      expect(result.dlpRules).toBeUndefined();
    });

    it("validates auditEvents must be a plain object", () => {
      const base = { auditEvents: [1, 2, 3] };
      const result = loadFixtureData(base);

      expect(result.auditEvents).toBeUndefined();
    });

    it("validates chromeReports must be a plain object", () => {
      const base = { chromeReports: "string-value" };
      const result = loadFixtureData(base);

      expect(result.chromeReports).toBeUndefined();
    });

    it("validates errors must be a plain object", () => {
      const base = { errors: ["not", "object"] };
      const result = loadFixtureData(base);

      expect(result.errors).toBeUndefined();
    });

    it("validates enrollmentToken must be a plain object", () => {
      const base = { enrollmentToken: "not-object" };
      const result = loadFixtureData(base);

      expect(result.enrollmentToken).toBeUndefined();
    });
  });

  describe("merge behavior", () => {
    it("override replaces base array fields entirely", () => {
      const base = {
        orgUnits: [{ orgUnitId: "id:a" }],
      };
      const override = {
        orgUnits: [{ orgUnitId: "id:b" }, { orgUnitId: "id:c" }],
      };

      const result = loadFixtureData(base, override);

      expect(result.orgUnits).toEqual([
        { orgUnitId: "id:b" },
        { orgUnitId: "id:c" },
      ]);
    });

    it("override deeply merges nested objects", () => {
      const base = {
        auditEvents: {
          items: [{ kind: "admin#reports#activity" }],
          nextPageToken: "token-1",
        },
      };
      const override = {
        auditEvents: {
          nextPageToken: "token-2",
        },
      };

      const result = loadFixtureData(base, override);

      expect(result.auditEvents).toEqual({
        items: [{ kind: "admin#reports#activity" }],
        nextPageToken: "token-2",
      });
    });

    it("override adds fields not present in base", () => {
      const base = {
        orgUnits: [{ orgUnitId: "id:a" }],
      };
      const override = {
        dlpRules: [{ displayName: "Test Rule" }],
      };

      const result = loadFixtureData(base, override);

      expect(result.orgUnits).toEqual([{ orgUnitId: "id:a" }]);
      expect(result.dlpRules).toEqual([{ displayName: "Test Rule" }]);
    });

    it("override with errors merges correctly", () => {
      const base = {
        errors: { chromeEvents: "timeout" },
      };
      const override = {
        errors: { dlpRules: "permission denied" },
      };

      const result = loadFixtureData(base, override);

      expect(result.errors).toEqual({
        chromeEvents: "timeout",
        dlpRules: "permission denied",
      });
    });
  });

  describe("edge cases", () => {
    it("handles non-object base gracefully", () => {
      const result = loadFixtureData("not-an-object");

      expect(result.orgUnits).toBeUndefined();
    });

    it("handles null base gracefully", () => {
      const result = loadFixtureData(null);

      expect(result.orgUnits).toBeUndefined();
    });

    it("handles non-object override gracefully", () => {
      const base = { orgUnits: [{ orgUnitId: "id:a" }] };
      const result = loadFixtureData(base, "not-an-object");

      expect(result.orgUnits).toEqual([{ orgUnitId: "id:a" }]);
    });

    it("handles undefined override same as missing", () => {
      const base = { orgUnits: [{ orgUnitId: "id:a" }] };
      const result = loadFixtureData(base, undefined);

      expect(result.orgUnits).toEqual([{ orgUnitId: "id:a" }]);
    });
  });
});
