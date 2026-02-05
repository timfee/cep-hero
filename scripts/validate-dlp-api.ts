#!/usr/bin/env bun
/**
 * Direct API validation script for Cloud Identity DLP rules.
 * Tests the v1beta1 API endpoint directly to validate the fix.
 *
 * Usage: bun run scripts/validate-dlp-api.ts
 *
 * Requires:
 * - GOOGLE_SERVICE_ACCOUNT_JSON or valid OAuth token
 * - GOOGLE_TOKEN_EMAIL for impersonation
 * - GOOGLE_CUSTOMER_ID (required - the actual customer ID like C046psxkn)
 */

import { loadEnvConfig } from "@next/env";
import { OAuth2Client } from "google-auth-library";

import { getServiceAccountAccessToken } from "@/lib/google-service-account";

loadEnvConfig(process.cwd());

const SCOPES = [
  "https://www.googleapis.com/auth/cloud-identity.policies",
  "https://www.googleapis.com/auth/cloud-identity.policies.readonly",
];

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
 * Test Cloud Identity v1beta1 policies.list API directly.
 */
async function testDlpApi(accessToken: string, customerId: string) {
  console.log("\n=== Testing Cloud Identity v1beta1 DLP API ===\n");
  console.log(`Customer ID: ${customerId}`);

  const filter = `customer == "customers/${customerId}" AND setting.type.matches("rule.dlp.*")`;
  console.log(`Filter: ${filter}\n`);

  const url = `https://cloudidentity.googleapis.com/v1beta1/policies?filter=${encodeURIComponent(filter)}`;

  console.log("Making request to:", url);
  console.log("");

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    console.log("❌ API Error:");
    console.log(`   Status: ${res.status} ${res.statusText}`);
    console.log(`   Error: ${JSON.stringify(data, null, 2)}`);

    if (JSON.stringify(data).includes("Filter is invalid")) {
      console.log("\n🔴 FAILURE: 'Filter is invalid' error detected!");
      console.log(
        "   This indicates the API version or filter syntax is wrong."
      );
      process.exit(1);
    }

    return false;
  }

  console.log("✅ API Success!");
  const policies = (data as { policies?: unknown[] }).policies ?? [];
  console.log(`   Found ${policies.length} policies`);

  if (policies.length > 0) {
    console.log("\n   Sample policy:");
    console.log(
      `   ${JSON.stringify(policies[0], null, 2).split("\n").join("\n   ")}`
    );
  }

  return true;
}

/**
 * Test that v1 API fails with the same filter (for comparison).
 */
async function testV1ApiFails(accessToken: string, customerId: string) {
  console.log(
    "\n=== Testing Cloud Identity v1 API (should fail or differ) ===\n"
  );

  const filter = `customer == "customers/${customerId}" AND setting.type.matches("rule.dlp.*")`;
  const url = `https://cloudidentity.googleapis.com/v1/policies?filter=${encodeURIComponent(filter)}`;

  console.log("Making request to:", url);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    console.log("✅ v1 API correctly returned error (expected):");
    console.log(`   Status: ${res.status}`);

    if (JSON.stringify(data).includes("Filter is invalid")) {
      console.log("   This confirms v1 doesn't support the filter syntax.");
    }
  } else {
    console.log("⚠️  v1 API succeeded (unexpected but acceptable)");
  }
}

async function main() {
  console.log("DLP API Validation Script");
  console.log("=".repeat(50));

  const customerId = stripQuotes(process.env.GOOGLE_CUSTOMER_ID);
  const tokenEmail = stripQuotes(process.env.GOOGLE_TOKEN_EMAIL);

  if (!customerId) {
    console.error("\n❌ ERROR: GOOGLE_CUSTOMER_ID is required");
    console.error("   Set the actual obfuscated customer ID (e.g., C046psxkn)");
    console.error("   The API won't work with 'my_customer'");
    process.exit(1);
  }

  console.log(`\nUsing customer ID: ${customerId}`);
  console.log(`Using token email: ${tokenEmail ?? "(not set)"}`);

  let accessToken: string;

  try {
    accessToken = await getServiceAccountAccessToken(SCOPES, tokenEmail);
    console.log("✅ Got access token from service account");
  } catch (error) {
    console.error("\n❌ Failed to get access token:", error);
    process.exit(1);
  }

  // Test v1beta1 (should work)
  const v1beta1Success = await testDlpApi(accessToken, customerId);

  // Test v1 for comparison (should fail or behave differently)
  await testV1ApiFails(accessToken, customerId);

  console.log("\n" + "=".repeat(50));
  if (v1beta1Success) {
    console.log("✅ VALIDATION PASSED: v1beta1 API works correctly");
  } else {
    console.log("❌ VALIDATION FAILED: v1beta1 API returned error");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
