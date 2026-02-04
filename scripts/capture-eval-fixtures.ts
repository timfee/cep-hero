/**
 * Captures base fixture data from Google APIs for eval testing with PII redaction.
 */

import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getServiceAccountAccessToken } from "@/lib/google-service-account";
import {
  listOrgUnits,
  listPolicySchemas,
  makeGoogleClients,
} from "@/lib/test-helpers/google-admin";

interface BaseFixture {
  orgUnits: {
    orgUnitId?: string | null;
    orgUnitPath?: string | null;
    name?: string | null;
    parentOrgUnitId?: string | null;
  }[];
  policySchemas: {
    name?: string | null;
    policyDescription?: string | null;
  }[];
  chromeReports: unknown;
  auditEvents: unknown;
}

const OUTPUT_DIR = path.join(process.cwd(), "evals", "fixtures", "base");

/**
 * Write JSON fixture with redaction for PII.
 */
async function writeFixture(name: string, payload: unknown) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const sanitized = sanitizeFixture(payload);
  const outputPath = path.join(OUTPUT_DIR, name);
  await writeFile(
    outputPath,
    `${JSON.stringify(sanitized, null, 2)}\n`,
    "utf8"
  );
  console.log(`[fixtures] wrote ${outputPath}`);
}

/**
 * Redact emails, customer IDs, paths, IPs, and hashes from fixture data.
 */
function sanitizeFixture(payload: unknown) {
  const raw = JSON.stringify(payload);
  const redactedEmails = raw.replaceAll(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    "<redacted-email>"
  );
  const redactedCustomers = redactedEmails.replaceAll(
    /customers\/[A-Za-z0-9_-]+/g,
    "customers/<redacted>"
  );
  const redactedPaths = redactedCustomers.replaceAll(
    /\/home\/[^"\s]+/g,
    "<redacted-path>"
  );
  const redactedIpv4 = redactedPaths.replaceAll(
    /\b\d{1,3}(?:\.\d{1,3}){3}\b/g,
    "<redacted-ipv4>"
  );
  const redactedIpv6 = redactedIpv4.replaceAll(
    /\b(?=[a-f0-9:]*[a-f])[a-f0-9]{0,4}(?::[a-f0-9]{0,4}){2,}\b/gi,
    "<redacted-ipv6>"
  );
  const redactedHashes = redactedIpv6.replaceAll(
    /\b[a-f0-9]{32,256}\b/gi,
    "<redacted-hash>"
  );
  const redactedCustomerId = redactedHashes.replaceAll(
    /"customerId":"[^"]+"/g,
    '"customerId":"<redacted>"'
  );
  const redactedProfileId = redactedCustomerId.replaceAll(
    /"profileId":"[^"]+"/g,
    '"profileId":"<redacted>"'
  );
  const redactedUrls = redactedProfileId.replaceAll(
    /https?:\/\/[^"]+/g,
    "https://<redacted-domain>"
  );
  return JSON.parse(redactedUrls);
}

/**
 * Capture Chrome Management reports sample.
 */
async function captureChromeReports() {
  const tokenEmail = process.env.GOOGLE_TOKEN_EMAIL;
  try {
    const accessToken = await getServiceAccountAccessToken(
      ["https://www.googleapis.com/auth/chrome.management.reports.readonly"],
      tokenEmail
    );
    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: accessToken });
    const management = google.chromemanagement({ version: "v1", auth });
    const { customerId } = await makeGoogleClients();
    const res = await management.customers.reports.countChromeVersions({
      customer: `customers/${customerId}`,
      filter: "last_active_date <= 30",
    });
    return res.data;
  } catch (error) {
    return { error: String(error) };
  }
}

/**
 * Capture Admin Reports audit sample.
 */
async function captureAuditEvents() {
  const tokenEmail = process.env.GOOGLE_TOKEN_EMAIL;
  if (tokenEmail === undefined || tokenEmail === "") {
    return { error: "GOOGLE_TOKEN_EMAIL is not set." };
  }
  try {
    const accessToken = await getServiceAccountAccessToken(
      ["https://www.googleapis.com/auth/admin.reports.audit.readonly"],
      tokenEmail
    );
    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: accessToken });
    const reports = google.admin({ version: "reports_v1", auth });
    const res = await reports.activities.list({
      userKey: tokenEmail,
      applicationName: "chrome",
      maxResults: 5,
    });
    return res.data;
  } catch (error) {
    return { error: String(error) };
  }
}

/**
 * Main fixture capture routine.
 */
async function run() {
  const orgUnitsResponse = await listOrgUnits();
  const orgUnits = orgUnitsResponse.slice(0, 10).map((unit) => ({
    orgUnitId: unit.orgUnitId ?? null,
    orgUnitPath: unit.orgUnitPath ?? null,
    name: unit.name ?? null,
    parentOrgUnitId: unit.parentOrgUnitId ?? null,
  }));
  const policySchemasResponse = await listPolicySchemas({ pageSize: 10 });
  const policySchemas = policySchemasResponse.map((schema) => ({
    name: schema.name ?? null,
    policyDescription: schema.policyDescription ?? null,
  }));
  const chromeReports = await captureChromeReports();
  const auditEvents = await captureAuditEvents();

  const payload: BaseFixture = {
    orgUnits,
    policySchemas,
    chromeReports,
    auditEvents,
  };

  await writeFixture("api-base.json", payload);
}

try {
  await run();
} catch (error) {
  console.error("[fixtures] capture failed", error);
  process.exitCode = 1;
}
