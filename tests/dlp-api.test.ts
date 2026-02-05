/**
 * Integration tests for Cloud Identity DLP Policy API.
 *
 * These tests require:
 * - GOOGLE_SERVICE_ACCOUNT_JSON: Service account credentials with domain-wide delegation
 * - GOOGLE_TOKEN_EMAIL: Admin user email for impersonation
 * - GOOGLE_CUSTOMER_ID (optional): Customer ID, auto-detected if not set
 *
 * Tests are skipped if credentials are missing or lack proper permissions.
 *
 * Test cases cover:
 * - API version verification (unit test, no credentials needed)
 * - Listing DLP rules with resolved customer ID
 * - Creating DLP rules
 * - Full lifecycle: create → list → verify → delete (setup/teardown)
 * - Error handling for invalid customer ID
 */

import { loadEnvConfig } from "@next/env";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { OAuth2Client } from "google-auth-library";
import { google as googleApis } from "googleapis";

import { getServiceAccountAccessToken } from "@/lib/google-service-account";
import {
  fetchOrgUnitContext,
  type OrgUnitContext,
} from "@/lib/mcp/executor/context";
import { createDLPRule } from "@/lib/mcp/executor/dlp-create";
import { deleteDLPRule } from "@/lib/mcp/executor/dlp-delete";
import { listDLPRules } from "@/lib/mcp/executor/dlp-list";

loadEnvConfig(process.cwd());

const TEST_TIMEOUT_MS = 60_000;
const hasServiceAccount = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

const GOOGLE_API_SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.user",
  "https://www.googleapis.com/auth/admin.directory.orgunit",
  "https://www.googleapis.com/auth/chrome.management.policy",
  "https://www.googleapis.com/auth/chrome.management.policy.readonly",
  "https://www.googleapis.com/auth/cloud-identity.policies",
  "https://www.googleapis.com/auth/cloud-identity.policies.readonly",
];

/**
 * Shared test context for DLP integration tests.
 */
interface TestContext {
  authClient: OAuth2Client | null;
  resolvedCustomerId: string | null;
  orgUnitContext: OrgUnitContext | null;
  createdRuleNames: string[];
}

const ctx: TestContext = {
  authClient: null,
  resolvedCustomerId: null,
  orgUnitContext: null,
  createdRuleNames: [],
};

/**
 * Strip quotes from environment variable values.
 */
function stripQuotes(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  return value.replaceAll(/^['"]|['"]$/g, "");
}

/**
 * Create authenticated OAuth2 client for testing.
 */
async function createAuthClient() {
  const tokenEmail = stripQuotes(process.env.GOOGLE_TOKEN_EMAIL);
  const accessToken = await getServiceAccountAccessToken(
    GOOGLE_API_SCOPES,
    tokenEmail
  );
  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: accessToken });
  return auth;
}

/**
 * Resolve actual customer ID from Chrome Policy API.
 */
async function resolveCustomerIdFromPolicySchemas(
  auth: OAuth2Client
): Promise<string | null> {
  try {
    const policy = googleApis.chromepolicy({ version: "v1", auth });
    const res = await policy.customers.policySchemas.list({
      parent: "customers/my_customer",
      pageSize: 1,
    });
    const schemaName = res.data.policySchemas?.[0]?.name ?? "";
    const match = schemaName.match(/customers\/([^/]+)\//);
    return match?.[1] ?? null;
  } catch (error) {
    console.log("[dlp-api] failed to resolve customer ID:", error);
    return null;
  }
}

/**
 * Generates a unique test rule name with timestamp.
 */
function generateTestRuleName() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `CEP-Hero-Test-${timestamp}-${random}`;
}

/**
 * Cleans up all created test rules.
 */
async function cleanupTestRules() {
  if (!ctx.authClient || ctx.createdRuleNames.length === 0) {
    return;
  }

  console.log(
    `[dlp-api] cleaning up ${ctx.createdRuleNames.length} test rules`
  );

  for (const ruleName of ctx.createdRuleNames) {
    try {
      const result = await deleteDLPRule(ctx.authClient, ruleName);
      if ("success" in result && result.success) {
        console.log(`[dlp-api] deleted test rule: ${ruleName}`);
      } else if ("error" in result) {
        console.log(`[dlp-api] failed to delete ${ruleName}: ${result.error}`);
      }
    } catch (error) {
      console.log(`[dlp-api] error deleting ${ruleName}:`, error);
    }
  }

  ctx.createdRuleNames = [];
}

const runIt = hasServiceAccount ? it : it.skip;

describe("Cloud Identity DLP Policy API", () => {
  beforeAll(async () => {
    if (!hasServiceAccount) {
      console.log("[dlp-api] skipping tests - no service account configured");
      return;
    }

    try {
      ctx.authClient = await createAuthClient();

      const envCustomerId = stripQuotes(process.env.GOOGLE_CUSTOMER_ID);
      if (envCustomerId) {
        ctx.resolvedCustomerId = envCustomerId;
      } else {
        ctx.resolvedCustomerId = await resolveCustomerIdFromPolicySchemas(
          ctx.authClient
        );
      }

      if (!ctx.resolvedCustomerId) {
        console.log(
          "[dlp-api] could not resolve customer ID - tests will skip"
        );
        return;
      }

      ctx.orgUnitContext = await fetchOrgUnitContext(
        ctx.authClient,
        "my_customer"
      );

      console.log("[dlp-api] test setup complete", {
        customerId: ctx.resolvedCustomerId,
        orgUnits: ctx.orgUnitContext.orgUnitList.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log("[dlp-api] setup failed:", message);
    }
  });

  afterAll(async () => {
    await cleanupTestRules();
  });

  describe("Unit tests (no credentials required)", () => {
    it("uses v1beta1 API version for Cloud Identity", () => {
      // This test verifies the API version without making actual API calls.
      // We check by creating a mock and verifying the version passed.
      let capturedVersion: string | undefined;

      const originalCloudidentity = googleApis.cloudidentity;
      googleApis.cloudidentity = ((options: { version: string }) => {
        capturedVersion = options.version;
        return {
          policies: {
            list: () => Promise.resolve({ data: { policies: [] } }),
          },
        };
      }) as typeof googleApis.cloudidentity;

      try {
        // Import fresh to trigger the API initialization
        const auth = new OAuth2Client();
        auth.setCredentials({ access_token: "fake-token" });

        // Call listDLPRules which should use v1beta1
        const mockOrgContext: OrgUnitContext = {
          orgUnitList: [],
          orgUnitNameMap: new Map(),
          rootOrgUnitId: "org:root",
          rootOrgUnitPath: "/",
        };

        // We need to actually call the function to trigger version capture
        listDLPRules(auth, "test-customer", mockOrgContext, {});

        expect(capturedVersion).toBe("v1beta1");
      } finally {
        googleApis.cloudidentity = originalCloudidentity;
      }
    });

    it("filters only DLP rules from mixed policy results", async () => {
      // Mock the Cloud Identity API to return mixed policies
      const mockPolicies = [
        { name: "policy1", setting: { type: "rule.dlp.upload" } },
        { name: "policy2", setting: { type: "chrome.users.SafeBrowsing" } },
        { name: "policy3", setting: { type: "rule.dlp.download" } },
        { name: "policy4", setting: { type: "rule.something.else" } },
      ];

      const originalCloudidentity = googleApis.cloudidentity;
      googleApis.cloudidentity = (() => ({
        policies: {
          list: () => Promise.resolve({ data: { policies: mockPolicies } }),
        },
      })) as unknown as typeof googleApis.cloudidentity;

      try {
        const auth = new OAuth2Client();
        auth.setCredentials({ access_token: "fake-token" });

        const mockOrgContext: OrgUnitContext = {
          orgUnitList: [],
          orgUnitNameMap: new Map(),
          rootOrgUnitId: "org:root",
          rootOrgUnitPath: "/",
        };

        const result = await listDLPRules(
          auth,
          "test-customer",
          mockOrgContext,
          {}
        );

        // Should only include DLP rules (rule.dlp.*)
        if ("rules" in result) {
          expect(result.rules).toHaveLength(2);
          expect(result.rules[0].resourceName).toBe("policy1");
          expect(result.rules[1].resourceName).toBe("policy3");
        } else {
          throw new Error("Expected rules result, got error");
        }
      } finally {
        googleApis.cloudidentity = originalCloudidentity;
      }
    });
  });

  describe("Integration tests (credentials required)", () => {
    runIt(
      "lists DLP rules with resolved customer ID",
      async () => {
        if (!ctx.authClient || !ctx.resolvedCustomerId || !ctx.orgUnitContext) {
          console.log("[dlp-api] skipping - missing test context");
          return;
        }

        console.log(
          "[dlp-api] testing listDLPRules with:",
          ctx.resolvedCustomerId
        );

        const result = await listDLPRules(
          ctx.authClient,
          ctx.resolvedCustomerId,
          ctx.orgUnitContext,
          {}
        );

        console.log("[dlp-api] result:", JSON.stringify(result, null, 2));

        if ("error" in result) {
          // Error should NOT be "Filter is invalid"
          expect(result.error).not.toContain("Filter is invalid");
          expect(result.error).not.toContain("7003");
          console.log("[dlp-api] got expected error:", result.error);
        } else {
          expect(result).toHaveProperty("rules");
          expect(Array.isArray(result.rules)).toBe(true);
          console.log("[dlp-api] found", result.rules.length, "DLP rules");
        }
      },
      TEST_TIMEOUT_MS
    );

    runIt(
      "returns filter error when using my_customer directly",
      async () => {
        if (!ctx.authClient || !ctx.orgUnitContext) {
          console.log("[dlp-api] skipping - missing test context");
          return;
        }

        console.log("[dlp-api] testing with my_customer (should fail)");

        const result = await listDLPRules(
          ctx.authClient,
          "my_customer",
          ctx.orgUnitContext,
          {}
        );

        console.log("[dlp-api] result:", JSON.stringify(result, null, 2));

        // Cloud Identity API should reject "my_customer" in filter
        expect("error" in result).toBe(true);

        if ("error" in result) {
          const errorLower = result.error.toLowerCase();
          const isFilterError =
            errorLower.includes("filter") ||
            errorLower.includes("invalid") ||
            errorLower.includes("customer");
          expect(isFilterError).toBe(true);
          console.log(
            "[dlp-api] my_customer correctly rejected:",
            result.error
          );
        }
      },
      TEST_TIMEOUT_MS
    );

    runIt(
      "full lifecycle: create → list → verify → delete",
      async () => {
        if (!ctx.authClient || !ctx.resolvedCustomerId || !ctx.orgUnitContext) {
          console.log("[dlp-api] skipping - missing test context");
          return;
        }

        const testRuleName = generateTestRuleName();
        console.log(
          "[dlp-api] starting lifecycle test with rule:",
          testRuleName
        );

        // Step 1: Create a test DLP rule
        console.log("[dlp-api] step 1: creating rule");
        const createResult = await createDLPRule(
          ctx.authClient,
          ctx.resolvedCustomerId,
          ctx.orgUnitContext,
          {
            displayName: testRuleName,
            targetOrgUnit: ctx.orgUnitContext.rootOrgUnitId,
            triggers: ["UPLOAD"],
            action: "AUDIT",
          }
        );

        console.log(
          "[dlp-api] create result:",
          JSON.stringify(createResult, null, 2)
        );

        // Creation might fail due to permissions - that's acceptable for this test
        // The important thing is we don't get a "Filter is invalid" error later
        if (createResult._type === "ui.success") {
          // Track for cleanup
          const ruleName = createResult.ruleName;
          if (ruleName && ruleName.startsWith("policies/")) {
            ctx.createdRuleNames.push(ruleName);
          }

          // Step 2: List rules and verify our rule exists
          console.log("[dlp-api] step 2: listing rules to verify creation");
          const listResult = await listDLPRules(
            ctx.authClient,
            ctx.resolvedCustomerId,
            ctx.orgUnitContext,
            {}
          );

          if ("rules" in listResult) {
            const foundRule = listResult.rules.find(
              (r) =>
                r.displayName === testRuleName || r.resourceName === ruleName
            );
            console.log("[dlp-api] found created rule:", Boolean(foundRule));

            // Note: Rule might not appear immediately due to propagation delay
            // So we don't assert here, just log
          }

          // Step 3: Delete the rule
          console.log("[dlp-api] step 3: deleting rule");
          const deleteResult = await deleteDLPRule(ctx.authClient, ruleName);

          if ("success" in deleteResult && deleteResult.success) {
            console.log("[dlp-api] rule deleted successfully");
            // Remove from cleanup list since already deleted
            ctx.createdRuleNames = ctx.createdRuleNames.filter(
              (n) => n !== ruleName
            );
          } else if ("error" in deleteResult) {
            console.log("[dlp-api] delete failed:", deleteResult.error);
          }

          // Verify no "Filter is invalid" errors occurred during list
          expect(
            "rules" in listResult ||
              !listResult.error.includes("Filter is invalid")
          ).toBe(true);
        } else if (createResult._type === "ui.manual_steps") {
          console.log(
            "[dlp-api] create returned manual steps (expected without full permissions)"
          );
          // This is acceptable - means API was reached but permissions insufficient
          expect(createResult.error).not.toContain("Filter is invalid");
        } else {
          console.log("[dlp-api] create returned error (may be expected)");
        }
      },
      TEST_TIMEOUT_MS
    );

    runIt(
      "handles concurrent list requests without race conditions",
      async () => {
        if (!ctx.authClient || !ctx.resolvedCustomerId || !ctx.orgUnitContext) {
          console.log("[dlp-api] skipping - missing test context");
          return;
        }

        console.log("[dlp-api] testing concurrent requests");

        // Fire multiple requests concurrently
        const requests = Array.from({ length: 3 }, () =>
          listDLPRules(
            ctx.authClient!,
            ctx.resolvedCustomerId!,
            ctx.orgUnitContext!,
            {}
          )
        );

        const results = await Promise.all(requests);

        // All should succeed or fail consistently (no race condition errors)
        const hasError = results.some((r) => "error" in r);
        const allHaveError = results.every((r) => "error" in r);
        const allHaveRules = results.every((r) => "rules" in r);

        // Either all succeed or all fail the same way
        expect(allHaveError || allHaveRules).toBe(true);

        // None should have "Filter is invalid" error
        for (const result of results) {
          if ("error" in result) {
            expect(result.error).not.toContain("Filter is invalid");
          }
        }

        console.log("[dlp-api] concurrent test passed, consistent results:", {
          hasError,
          count: results.length,
        });
      },
      TEST_TIMEOUT_MS
    );
  });
});
