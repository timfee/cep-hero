import dotenv from "dotenv";
import { existsSync } from "fs";
import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";

import { getServiceAccountAccessToken } from "@/lib/google-service-account";
import { makeGoogleClients } from "@/lib/test-helpers/google-admin";

type CheckResult = {
  ok: boolean;
  warnings: string[];
  errors: string[];
};

const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.user",
  "https://www.googleapis.com/auth/admin.directory.orgunit",
  "https://www.googleapis.com/auth/admin.directory.group",
  "https://www.googleapis.com/auth/admin.reports.audit.readonly",
  "https://www.googleapis.com/auth/chrome.management.policy",
  "https://www.googleapis.com/auth/chrome.management.policy.readonly",
  "https://www.googleapis.com/auth/chrome.management.reports.readonly",
];

/** Load dotenv from .env.local when present. */
function loadEnv() {
  const localPath = ".env.local";
  if (existsSync(localPath)) {
    dotenv.config({ path: localPath });
  }
  dotenv.config();
}

/** Parse and validate service account JSON from env. */
function parseServiceAccountJson(): {
  client_email?: string;
  private_key?: string;
  error?: string;
} {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    return { error: "Missing GOOGLE_SERVICE_ACCOUNT_JSON." };
  }
  try {
    const trimmed = raw.replace(/^['"]|['"]$/g, "");
    const parsed = JSON.parse(trimmed);
    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
    };
  } catch (error) {
    return { error: `Invalid GOOGLE_SERVICE_ACCOUNT_JSON: ${String(error)}` };
  }
}

/** Check credentials and report actionable guidance. */
async function checkCredentials(): Promise<CheckResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  const tokenEmail = process.env.GOOGLE_TOKEN_EMAIL;
  const customerId = process.env.GOOGLE_CUSTOMER_ID;
  const testDomain = process.env.TEST_USER_DOMAIN;

  const serviceAccount = parseServiceAccountJson();
  if (serviceAccount.error) {
    errors.push(serviceAccount.error);
  } else {
    if (!serviceAccount.client_email) {
      errors.push("Service account JSON missing client_email.");
    }
    if (!serviceAccount.private_key) {
      errors.push("Service account JSON missing private_key.");
    }
  }

  if (!tokenEmail) {
    errors.push("Missing GOOGLE_TOKEN_EMAIL (impersonation subject).");
  }

  if (!customerId) {
    warnings.push("GOOGLE_CUSTOMER_ID not set; will attempt to resolve.");
  }

  if (!testDomain && tokenEmail && !tokenEmail.includes("@")) {
    warnings.push("TEST_USER_DOMAIN not set; using token email domain.");
  }

  if (errors.length > 0) {
    return { ok: false, warnings, errors };
  }

  try {
    await getServiceAccountAccessToken(REQUIRED_SCOPES, tokenEmail);
  } catch (error) {
    errors.push(`Access token error: ${String(error)}`);
    return { ok: false, warnings, errors };
  }

  try {
    await makeGoogleClients();
  } catch (error) {
    warnings.push(`API client init warning: ${String(error)}`);
  }

  try {
    const accessToken = await getServiceAccountAccessToken(
      ["https://www.googleapis.com/auth/chrome.management.reports.readonly"],
      tokenEmail
    );
    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: accessToken });
    const management = google.chromemanagement({ version: "v1", auth });
    const customer = customerId
      ? `customers/${customerId}`
      : "customers/my_customer";
    await management.customers.reports.countChromeVersions({
      customer,
      filter: "last_active_date <= 30",
    });
  } catch (error) {
    warnings.push(
      `Chrome reports scope or API issue: ${String(error)}. Ensure the Chrome Management API is enabled.`
    );
  }

  return { ok: errors.length === 0, warnings, errors };
}

async function run() {
  loadEnv();
  const result = await checkCredentials();
  console.log("[credentials] status", result.ok ? "ok" : "error");
  if (result.warnings.length > 0) {
    console.log("[credentials] warnings:");
    for (const warning of result.warnings) {
      console.log(`- ${warning}`);
    }
  }
  if (result.errors.length > 0) {
    console.log("[credentials] errors:");
    for (const error of result.errors) {
      console.log(`- ${error}`);
    }
    console.log("\nFixes:");
    console.log(
      "- Set GOOGLE_SERVICE_ACCOUNT_JSON to the service account JSON."
    );
    console.log("- Set GOOGLE_TOKEN_EMAIL to an admin user to impersonate.");
    console.log(
      "- Ensure domain-wide delegation and required scopes are enabled."
    );
    console.log("- Enable Chrome Management API in your Google Cloud project.");
  }
  process.exitCode = result.ok ? 0 : 1;
}

run().catch((error) => {
  console.error("[credentials] failed", error);
  process.exitCode = 1;
});
