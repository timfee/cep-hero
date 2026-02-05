#!/usr/bin/env bun
/**
 * Fix service account JSON in .env.local by escaping newlines.
 * Run with: bun scripts/fix-env-json.ts
 */

import { readFileSync, writeFileSync } from "fs";

const envPath = ".env.local";

console.log("Reading .env.local...");
const content = readFileSync(envPath, "utf-8");

// Find the GOOGLE_SERVICE_ACCOUNT_JSON line(s)
const lines = content.split("\n");
const result: string[] = [];
let inJson = false;
let jsonLines: string[] = [];

for (const line of lines) {
  if (line.startsWith("GOOGLE_SERVICE_ACCOUNT_JSON=")) {
    inJson = true;
    jsonLines.push(line.slice("GOOGLE_SERVICE_ACCOUNT_JSON=".length));
  } else if (inJson) {
    // Check if this continues the JSON (doesn't start with a new var)
    if (line.match(/^[A-Z_]+=/) || line.trim() === "") {
      // End of JSON, process it
      const rawJson = jsonLines.join("\n");
      // Remove surrounding quotes if present
      const cleaned = rawJson.replace(/^['"]|['"]$/g, "");
      // Escape newlines
      const escaped = cleaned.replace(/\n/g, "\\n");
      // Use single quotes to avoid shell issues
      result.push(`GOOGLE_SERVICE_ACCOUNT_JSON='${escaped}'`);
      jsonLines = [];
      inJson = false;
      result.push(line);
    } else {
      jsonLines.push(line);
    }
  } else {
    result.push(line);
  }
}

// Handle case where JSON is at end of file
if (inJson && jsonLines.length > 0) {
  const rawJson = jsonLines.join("\n");
  const cleaned = rawJson.replace(/^['"]|['"]$/g, "");
  const escaped = cleaned.replace(/\n/g, "\\n");
  result.push(`GOOGLE_SERVICE_ACCOUNT_JSON='${escaped}'`);
}

const fixed = result.join("\n");

// Verify the fix works
const match = fixed.match(/GOOGLE_SERVICE_ACCOUNT_JSON='([^']+)'/);
if (match) {
  try {
    JSON.parse(match[1]);
    console.log("✓ Fixed JSON parses correctly");
    writeFileSync(envPath, fixed);
    console.log("✓ Updated .env.local");
  } catch (e) {
    console.log("✗ Fix didn't work:", e);
    process.exit(1);
  }
} else {
  console.log("✗ Could not extract JSON from result");
  process.exit(1);
}
