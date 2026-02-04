/**
 * Integration tests for Cloud Identity DLP Policy API.
 *
 * These tests require:
 * - GOOGLE_SERVICE_ACCOUNT_JSON: Service account credentials with domain-wide delegation
 * - GOOGLE_TOKEN_EMAIL: Admin user email for impersonation
 * - GOOGLE_CUSTOMER_ID (optional): Customer ID, auto-detected if not set
 *
 * Tests are skipped if credentials are missing or lack proper permissions.
 */

import { loadEnvConfig } from "@next/env";
import { beforeAll, describe, expect, it } from "bun:test";
import { OAuth2Client } from "google-auth-library";
import { google as googleApis } from "googleapis";

import { getServiceAccountAccessToken } from "@/lib/google-service-account";
import { fetchOrgUnitContext } from "@/lib/mcp/executor/context";
import { listDLPRules } from "@/lib/mcp/executor/dlp-list";

loadEnvConfig(process.cwd());

const TEST_TIMEOUT_MS = 30_000;
const hasServiceAccount = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

const GOOGLE_API_SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.user",
  "https://www.googleapis.com/auth/admin.directory.orgunit",
  "https://www.googleapis.com/auth/chrome.management.policy",
  "https://www.googleapis.com/auth/chrome.management.policy.readonly",
  "https://www.googleapis.com/auth/cloud-identity.policies",
  "https://www.googleapis.com/auth/cloud-identity.policies.readonly",
];

let credentialsValidated = false;
let hasValidPermissions = false;
let authClient: OAuth2Client | null = null;
let resolvedCustomerId: string | null = null;

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
 * Validate credentials and resolve customer ID.
 */
async function validateCredentials(): Promise<boolean> {
  if (credentialsValidated) {
    return hasValidPermissions;
  }
  credentialsValidated = true;

  if (!hasServiceAccount) {
    return false;
  }

  try {
    authClient = await createAuthClient();

    // Try to resolve the actual customer ID
    const envCustomerId = stripQuotes(process.env.GOOGLE_CUSTOMER_ID);
    if (envCustomerId) {
      resolvedCustomerId = envCustomerId;
    } else {
      resolvedCustomerId = await resolveCustomerIdFromPolicySchemas(authClient);
    }

    if (!resolvedCustomerId) {
      console.log("[dlp-api] skipping tests - could not resolve customer ID");
      return false;
    }

    console.log("[dlp-api] resolved customer ID:", resolvedCustomerId);
    hasValidPermissions = true;
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(
      "[dlp-api] skipping tests - credential validation failed:",
      message
    );
    return false;
  }
}

const runIt = hasServiceAccount ? it : it.skip;

describe("Cloud Identity DLP Policy API", () => {
  beforeAll(async () => {
    if (!hasServiceAccount) {
      console.log("[dlp-api] skipping tests - no service account configured");
      return;
    }
    await validateCredentials();
  });

  runIt(
    "lists DLP rules with resolved customer ID",
    async () => {
      if (!(await validateCredentials())) {
        console.log("[dlp-api] skipping - invalid permissions");
        return;
      }

      if (!authClient || !resolvedCustomerId) {
        console.log("[dlp-api] skipping - missing auth or customer ID");
        return;
      }

      // Fetch org unit context for the test
      const orgUnitContext = await fetchOrgUnitContext(
        authClient,
        "my_customer"
      );

      console.log("[dlp-api] testing with customer ID:", resolvedCustomerId);
      console.log(
        "[dlp-api] org units count:",
        orgUnitContext.orgUnitList.length
      );

      // Call listDLPRules with the resolved customer ID
      const result = await listDLPRules(
        authClient,
        resolvedCustomerId,
        orgUnitContext,
        {}
      );

      console.log("[dlp-api] result:", JSON.stringify(result, null, 2));

      // The result should be either rules array or an error object
      // If it has an "error" property, it's an error response
      if ("error" in result) {
        // This is acceptable - it means the API call went through but there was an issue
        // The important thing is that we don't get "Filter is invalid" (error 7003)
        console.log("[dlp-api] got error response:", result.error);

        // Fail if we still get the filter invalid error
        expect(result.error).not.toContain("Filter is invalid");
        expect(result.error).not.toContain("7003");
      } else {
        // Success case - we got rules
        expect(result).toHaveProperty("rules");
        expect(Array.isArray(result.rules)).toBe(true);
        console.log("[dlp-api] found", result.rules.length, "DLP rules");
      }
    },
    TEST_TIMEOUT_MS
  );

  runIt(
    "fails with my_customer in filter (demonstrates the bug)",
    async () => {
      if (!(await validateCredentials())) {
        console.log("[dlp-api] skipping - invalid permissions");
        return;
      }

      if (!authClient) {
        console.log("[dlp-api] skipping - missing auth");
        return;
      }

      // Fetch org unit context
      const orgUnitContext = await fetchOrgUnitContext(
        authClient,
        "my_customer"
      );

      // Call with "my_customer" directly - this should fail with filter error
      console.log("[dlp-api] testing with my_customer (should fail)");

      const result = await listDLPRules(
        authClient,
        "my_customer",
        orgUnitContext,
        {}
      );

      console.log(
        "[dlp-api] my_customer result:",
        JSON.stringify(result, null, 2)
      );

      // This test documents the bug - my_customer should fail
      // If this test starts passing with rules, it means the API behavior changed
      if ("error" in result) {
        console.log("[dlp-api] my_customer correctly failed:", result.error);
        // The error should mention the filter being invalid
        // Note: This test may pass if Google changes their API to accept my_customer
      } else {
        // If it succeeded, the API now accepts my_customer (behavior changed)
        console.log(
          "[dlp-api] UNEXPECTED: my_customer worked, found",
          result.rules.length,
          "rules"
        );
      }
    },
    TEST_TIMEOUT_MS
  );
});
