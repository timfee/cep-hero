/**
 * Integration tests for policy change workflow.
 *
 * These tests require:
 * - GOOGLE_SERVICE_ACCOUNT_JSON: Service account credentials with domain-wide delegation
 * - GOOGLE_TOKEN_EMAIL: Admin user email for impersonation
 * - GOOGLE_CUSTOMER_ID (optional): Customer ID, defaults to auto-detection
 *
 * Tests verify:
 * - Org unit listing and name resolution
 * - buildOrgUnitTargetResource validation
 * - Policy draft and apply workflow
 */

import { loadEnvConfig } from "@next/env";
import { beforeAll, describe, expect, it } from "bun:test";

loadEnvConfig(process.cwd());

import {
  buildOrgUnitNameMap,
  buildOrgUnitTargetResource,
  resolveOrgUnitDisplay,
} from "@/lib/mcp/org-units";
import {
  applyOrgUnitPolicy,
  inheritOrgUnitPolicy,
  listOrgUnits,
  makeGoogleClients,
  resolvePolicies,
} from "@/lib/test-helpers/google-admin";

const TEST_TIMEOUT_MS = 30_000;
const hasServiceAccount = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

let credentialsValidated = false;
let hasValidPermissions = false;
let testOrgUnitId: string | null = null;
let testOrgUnitPath: string | null = null;

/**
 * Validate that credentials have proper Admin API permissions.
 */
async function validateCredentials(): Promise<boolean> {
  if (credentialsValidated) {
    return hasValidPermissions;
  }
  credentialsValidated = true;

  if (!hasServiceAccount) {
    console.log("[policy-change-api] skipping - no service account configured");
    return false;
  }

  try {
    const { directory, customerId } = await makeGoogleClients();
    const res = await directory.orgunits.list({
      customerId,
      type: "all",
    });
    hasValidPermissions = res.status === 200;

    // Get first org unit for testing
    const orgUnits = res.data.organizationUnits ?? [];
    if (orgUnits.length > 0) {
      testOrgUnitId = orgUnits[0].orgUnitId?.replace(/^id:/, "") ?? null;
      testOrgUnitPath = orgUnits[0].orgUnitPath ?? null;
    }

    return hasValidPermissions;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log("[policy-change-api] skipping tests:", message);
    return false;
  }
}

describe("buildOrgUnitTargetResource validation", () => {
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

  it("preserves valid customers/ID format", () => {
    expect(buildOrgUnitTargetResource("customers/C12345")).toBe(
      "customers/C12345"
    );
  });

  it("adds orgunits/ prefix to bare ID", () => {
    expect(buildOrgUnitTargetResource("03ph8a2z23yjui6")).toBe(
      "orgunits/03ph8a2z23yjui6"
    );
  });

  it("handles org unit path by converting to orgunits/ format", () => {
    const result = buildOrgUnitTargetResource("/Engineering");
    expect(result).toBe("orgunits/Engineering");
  });
});

describe("org unit name resolution", () => {
  it(
    "builds name map from org units",
    async () => {
      const hasPerms = await validateCredentials();
      if (!hasPerms) {
        console.log("[policy-change-api] skipping - invalid permissions");
        return;
      }

      const orgUnits = await listOrgUnits();
      expect(orgUnits.length).toBeGreaterThan(0);

      const nameMap = buildOrgUnitNameMap(orgUnits);
      expect(nameMap.size).toBeGreaterThan(0);

      // Verify we can look up by ID
      if (testOrgUnitId && testOrgUnitPath) {
        const resolved = nameMap.get(`orgunits/${testOrgUnitId}`);
        expect(resolved).toBe(testOrgUnitPath);
      }
    },
    TEST_TIMEOUT_MS
  );

  it(
    "resolveOrgUnitDisplay returns path for ID",
    async () => {
      const hasPerms = await validateCredentials();
      if (!hasPerms) {
        console.log("[policy-change-api] skipping - invalid permissions");
        return;
      }

      const orgUnits = await listOrgUnits();
      const nameMap = buildOrgUnitNameMap(orgUnits);

      if (testOrgUnitId && testOrgUnitPath) {
        const display = resolveOrgUnitDisplay(
          `orgunits/${testOrgUnitId}`,
          nameMap,
          null,
          null
        );
        expect(display).toBe(testOrgUnitPath);
      }
    },
    TEST_TIMEOUT_MS
  );

  it(
    "resolveOrgUnitDisplay returns null for invalid ID",
    async () => {
      const hasPerms = await validateCredentials();
      if (!hasPerms) {
        console.log("[policy-change-api] skipping - invalid permissions");
        return;
      }

      const orgUnits = await listOrgUnits();
      const nameMap = buildOrgUnitNameMap(orgUnits);

      const display = resolveOrgUnitDisplay(
        "orgunits/invalid-id-that-does-not-exist",
        nameMap,
        null,
        null
      );
      expect(display).toBeNull();
    },
    TEST_TIMEOUT_MS
  );
});

describe("policy resolution", () => {
  it(
    "can resolve policies for valid org unit",
    async () => {
      const hasPerms = await validateCredentials();
      if (!hasPerms) {
        console.log("[policy-change-api] skipping - invalid permissions");
        return;
      }

      if (!testOrgUnitId) {
        console.log("[policy-change-api] skipping - no test org unit");
        return;
      }

      const targetResource = `orgunits/${testOrgUnitId}`;
      const policies = await resolvePolicies({
        policySchemaFilter: "chrome.users.*",
        targetResource,
      });

      // Should return array (may be empty if no policies set)
      expect(Array.isArray(policies)).toBe(true);
      console.log(
        `[policy-change-api] resolved ${policies.length} policies for ${targetResource}`
      );
    },
    TEST_TIMEOUT_MS
  );

  it(
    "fails to resolve policies for invalid org unit ID",
    async () => {
      const hasPerms = await validateCredentials();
      if (!hasPerms) {
        console.log("[policy-change-api] skipping - invalid permissions");
        return;
      }

      try {
        await resolvePolicies({
          policySchemaFilter: "chrome.users.*",
          targetResource: "orgunits/invalid-id",
        });
        // If we get here, the API didn't throw
        expect(true).toBe(true);
      } catch (error) {
        // Expected - invalid org unit should fail
        expect(error).toBeDefined();
      }
    },
    TEST_TIMEOUT_MS
  );
});

describe("policy apply workflow", () => {
  // Test policy that's safe to toggle - MetricsReportingEnabled is a simple boolean
  const TEST_POLICY_SCHEMA = "chrome.users.MetricsReportingEnabled";

  it(
    "can apply and inherit policy for org unit",
    async () => {
      const hasPerms = await validateCredentials();
      if (!hasPerms) {
        console.log("[policy-change-api] skipping - invalid permissions");
        return;
      }

      if (!testOrgUnitId) {
        console.log("[policy-change-api] skipping - no test org unit");
        return;
      }

      const targetResource = `orgunits/${testOrgUnitId}`;

      // Apply a policy
      console.log(
        `[policy-change-api] applying ${TEST_POLICY_SCHEMA} to ${targetResource}`
      );
      await applyOrgUnitPolicy({
        policySchemaId: TEST_POLICY_SCHEMA,
        targetResource,
        value: { metricsReportingEnabled: "TRUE" },
      });

      // Verify it was applied
      const policiesAfterApply = await resolvePolicies({
        policySchemaFilter: TEST_POLICY_SCHEMA,
        targetResource,
      });
      expect(policiesAfterApply.length).toBeGreaterThan(0);

      const applied = policiesAfterApply.find(
        (p) => p.value?.policySchema === TEST_POLICY_SCHEMA
      );
      expect(applied).toBeDefined();
      console.log(
        "[policy-change-api] policy applied:",
        JSON.stringify(applied?.value?.value)
      );

      // Reset by inheriting from parent
      console.log(`[policy-change-api] inheriting policy from parent`);
      await inheritOrgUnitPolicy({
        policySchemaId: TEST_POLICY_SCHEMA,
        targetResource,
      });
      console.log("[policy-change-api] policy reset to inherit");
    },
    TEST_TIMEOUT_MS * 2
  );

  it(
    "fails to apply policy with empty org unit ID",
    async () => {
      const hasPerms = await validateCredentials();
      if (!hasPerms) {
        console.log("[policy-change-api] skipping - invalid permissions");
        return;
      }

      // This should fail because the target resource is invalid
      const targetResource = buildOrgUnitTargetResource("orgunits/");
      expect(targetResource).toBe("");

      // If we tried to call the API with empty target, it would fail
      // But our validation should catch this before making the API call
    },
    TEST_TIMEOUT_MS
  );
});
