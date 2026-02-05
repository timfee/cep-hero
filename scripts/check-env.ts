#!/usr/bin/env bun
/**
 * Debug script to check environment variable configuration.
 * Run with: bun scripts/check-env.ts
 */

console.log("=== Environment Check ===\n");

// Check required env vars
const required = [
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "GOOGLE_TOKEN_EMAIL",
  "GOOGLE_CUSTOMER_ID",
];

for (const key of required) {
  const value = process.env[key];
  const status = value ? "✓" : "✗";
  const preview = value ? value.substring(0, 40) + "..." : "(not set)";
  console.log(`${status} ${key}: ${preview}`);
}

console.log("\n=== Service Account JSON Parse Test ===\n");

const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
if (!json) {
  console.log("✗ GOOGLE_SERVICE_ACCOUNT_JSON not set");
  process.exit(1);
}

// Check for literal newlines (common issue)
if (json.includes("\n")) {
  console.log("✗ JSON contains literal newlines - this will break parsing");
  console.log("\nTo fix: The JSON in .env.local must be on a single line.");
  console.log(
    "Private key newlines should be escaped as \\n, not actual newlines."
  );
  console.log("\nExample fix:");
  console.log(
    'GOOGLE_SERVICE_ACCOUNT_JSON=\'{"type":"service_account",...,"private_key":"-----BEGIN...\\n...\\n-----END..."}\''
  );
  process.exit(1);
}

try {
  const parsed = JSON.parse(json.replace(/^['"]|['"]$/g, ""));
  console.log("✓ JSON parses successfully");
  console.log(`  - type: ${parsed.type}`);
  console.log(`  - project_id: ${parsed.project_id}`);
  console.log(`  - client_email: ${parsed.client_email}`);
  console.log(`  - has private_key: ${!!parsed.private_key}`);
} catch (e) {
  console.log(`✗ JSON parse error: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}

console.log("\n=== All checks passed ===");
