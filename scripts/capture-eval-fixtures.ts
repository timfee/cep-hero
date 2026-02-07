/**
 * Captures base fixture data from ALL Google APIs for eval testing with PII redaction.
 *
 * Captured data types:
 * - orgUnits: Admin SDK Directory API
 * - policySchemas: Chrome Policy API
 * - chromeReports: Chrome Management Reports API
 * - auditEvents: Admin SDK Reports API (Chrome audit events)
 * - dlpRules: Cloud Identity v1beta1 (DLP policies)
 * - connectorPolicies: Chrome Policy API (resolve for connector schemas)
 *
 * Run: bun run fixtures:capture
 * Requires: GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_TOKEN_EMAIL in .env.local
 */

import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { stripQuotes } from "@/lib/gimme/validation";
import { getServiceAccountAccessToken } from "@/lib/google-service-account";
import { CONNECTOR_POLICY_SCHEMAS } from "@/lib/mcp/constants";
import {
  listOrgUnits,
  listPolicySchemas,
  makeGoogleClients,
  resolvePolicies,
} from "@/lib/test-helpers/google-admin";

/**
 * Full base fixture shape covering all data types used by FixtureToolExecutor.
 */
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
  dlpRules: unknown[];
  connectorPolicies: unknown[];
}

/**
 * All scopes needed across every API we capture from.
 */
const ALL_CAPTURE_SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.user",
  "https://www.googleapis.com/auth/admin.directory.orgunit",
  "https://www.googleapis.com/auth/admin.reports.audit.readonly",
  "https://www.googleapis.com/auth/chrome.management.policy",
  "https://www.googleapis.com/auth/chrome.management.policy.readonly",
  "https://www.googleapis.com/auth/chrome.management.reports.readonly",
  "https://www.googleapis.com/auth/cloud-identity.policies",
  "https://www.googleapis.com/auth/cloud-identity.policies.readonly",
];

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
 * Create a single authenticated OAuth2 client with all required scopes.
 */
async function createCaptureAuthClient() {
  const tokenEmail = stripQuotes(process.env.GOOGLE_TOKEN_EMAIL);
  if (!tokenEmail) {
    throw new Error("GOOGLE_TOKEN_EMAIL is required for fixture capture.");
  }
  const accessToken = await getServiceAccountAccessToken(
    ALL_CAPTURE_SCOPES,
    tokenEmail
  );
  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: accessToken });
  return { auth, tokenEmail };
}

/**
 * Capture Chrome Management reports sample.
 */
async function captureChromeReports(auth: OAuth2Client, customerId: string) {
  console.log("[fixtures] capturing chromeReports...");
  try {
    const management = google.chromemanagement({ version: "v1", auth });
    const res = await management.customers.reports.countChromeVersions({
      customer: `customers/${customerId}`,
      filter: "last_active_date <= 30",
    });
    console.log("[fixtures] chromeReports: OK");
    return res.data;
  } catch (error) {
    console.log("[fixtures] chromeReports: FAILED", String(error));
    return { error: String(error) };
  }
}

/**
 * Capture Admin Reports audit sample (Chrome events).
 */
async function captureAuditEvents(auth: OAuth2Client, tokenEmail: string) {
  console.log("[fixtures] capturing auditEvents...");
  try {
    const reports = google.admin({ version: "reports_v1", auth });
    const res = await reports.activities.list({
      userKey: tokenEmail,
      applicationName: "chrome",
      maxResults: 5,
    });
    const itemCount = res.data.items?.length ?? 0;
    console.log(`[fixtures] auditEvents: OK (${itemCount} items)`);
    return res.data;
  } catch (error) {
    console.log("[fixtures] auditEvents: FAILED", String(error));
    return { error: String(error) };
  }
}

/**
 * DLP rule setting type pattern (same as production code).
 */
const DLP_SETTING_TYPE_PATTERN = /^rule\.dlp/i;

/**
 * Raw Cloud Identity policy shape (subset of fields we need).
 */
interface RawCloudIdentityPolicy {
  name?: string | null;
  setting?: {
    type?: string | null;
    value?: Record<string, unknown> | null;
  } | null;
  policyQuery?: {
    orgUnit?: string | null;
  } | null;
}

/**
 * Transform a raw Cloud Identity DLP policy into the FixtureData.dlpRules shape.
 */
function transformDlpPolicy(raw: RawCloudIdentityPolicy) {
  const settingValue = raw.setting?.value ?? {};
  const triggers = Array.isArray(settingValue.triggers)
    ? (settingValue.triggers as string[])
    : [];
  const action =
    typeof settingValue.action === "string" ? settingValue.action : "AUDIT";
  const displayName =
    typeof settingValue.name === "string"
      ? settingValue.name
      : (raw.setting?.type ?? "");

  return {
    name: raw.name ?? undefined,
    displayName,
    description:
      typeof settingValue.description === "string"
        ? settingValue.description
        : "",
    settingType: raw.setting?.type ?? undefined,
    orgUnit: raw.policyQuery?.orgUnit ?? undefined,
    targetResource: raw.policyQuery?.orgUnit ?? undefined,
    action,
    triggers,
    enabled:
      typeof settingValue.enabled === "boolean"
        ? settingValue.enabled
        : undefined,
  };
}

/**
 * Capture DLP rules from Cloud Identity v1beta1 API.
 * Returns policies transformed to the FixtureData.dlpRules shape.
 */
async function captureDlpRules(auth: OAuth2Client, customerId: string) {
  console.log("[fixtures] capturing dlpRules...");
  try {
    const service = google.cloudidentity({ version: "v1beta1", auth });
    const res = await service.policies.list({
      filter: `customer == "customers/${customerId}"`,
    });
    const allPolicies = (res.data.policies ?? []) as RawCloudIdentityPolicy[];
    const dlpPolicies = allPolicies.filter((p) => {
      const settingType = p.setting?.type;
      return (
        typeof settingType === "string" &&
        DLP_SETTING_TYPE_PATTERN.test(settingType)
      );
    });
    console.log(
      `[fixtures] dlpRules: OK (${dlpPolicies.length} DLP rules from ${allPolicies.length} total policies)`
    );
    return dlpPolicies.map(transformDlpPolicy);
  } catch (error) {
    console.log("[fixtures] dlpRules: FAILED", String(error));
    return [];
  }
}

/**
 * Capture connector policies by resolving Chrome Policy API for connector schemas.
 * Uses the same schema filter and approach as the production connector.ts executor.
 */
async function captureConnectorPolicies(rootOrgUnitId: string | null) {
  console.log("[fixtures] capturing connectorPolicies...");
  if (!rootOrgUnitId) {
    console.log("[fixtures] connectorPolicies: SKIPPED (no root org unit)");
    return [];
  }

  try {
    const targetResource = rootOrgUnitId.startsWith("orgunits/")
      ? rootOrgUnitId
      : rootOrgUnitId.startsWith("id:")
        ? `orgunits/${rootOrgUnitId.slice(3)}`
        : `orgunits/${rootOrgUnitId}`;

    const policies = await resolvePolicies({
      policySchemaFilter: CONNECTOR_POLICY_SCHEMAS.join(","),
      targetResource,
    });
    console.log(
      `[fixtures] connectorPolicies: OK (${policies.length} policies)`
    );
    // Return raw API response shape — resolvedPolicies use targetKey (NOT policyTargetKey)
    return policies;
  } catch (error) {
    console.log("[fixtures] connectorPolicies: FAILED", String(error));
    return [];
  }
}

/**
 * Detect root org unit ID from the list of captured org units.
 */
function detectRootOrgUnitId(
  orgUnits: { orgUnitId?: string | null; orgUnitPath?: string | null }[]
) {
  const root = orgUnits.find((ou) => ou.orgUnitPath === "/");
  return root?.orgUnitId ?? orgUnits[0]?.orgUnitId ?? null;
}

/**
 * Main fixture capture routine. Captures ALL data types from live Google APIs.
 */
async function run() {
  console.log("[fixtures] starting capture...\n");

  const { auth, tokenEmail } = await createCaptureAuthClient();
  const { customerId } = await makeGoogleClients();
  console.log(`[fixtures] authenticated, customerId=${customerId}\n`);

  // 1. Org units (needed by other captures)
  console.log("[fixtures] capturing orgUnits...");
  const orgUnitsResponse = await listOrgUnits();
  const orgUnits = orgUnitsResponse.slice(0, 10).map((unit) => ({
    orgUnitId: unit.orgUnitId ?? null,
    orgUnitPath: unit.orgUnitPath ?? null,
    name: unit.name ?? null,
    parentOrgUnitId: unit.parentOrgUnitId ?? null,
  }));
  console.log(`[fixtures] orgUnits: OK (${orgUnits.length} units)\n`);

  const rootOrgUnitId = detectRootOrgUnitId(orgUnits);

  // 2. Policy schemas
  console.log("[fixtures] capturing policySchemas...");
  const policySchemasResponse = await listPolicySchemas({ pageSize: 10 });
  const policySchemas = policySchemasResponse.map((schema) => ({
    name: schema.name ?? null,
    policyDescription: schema.policyDescription ?? null,
  }));
  console.log(
    `[fixtures] policySchemas: OK (${policySchemas.length} schemas)\n`
  );

  // 3-6. Capture remaining data types in parallel
  const [chromeReports, auditEvents, dlpRules, connectorPolicies] =
    await Promise.all([
      captureChromeReports(auth, customerId),
      captureAuditEvents(auth, tokenEmail),
      captureDlpRules(auth, customerId),
      captureConnectorPolicies(rootOrgUnitId),
    ]);

  const payload: BaseFixture = {
    orgUnits,
    policySchemas,
    chromeReports,
    auditEvents,
    dlpRules,
    connectorPolicies,
  };

  console.log("\n[fixtures] writing output...");
  await writeFixture("api-base.json", payload);
  console.log("[fixtures] capture complete!");
}

try {
  await run();
} catch (error) {
  console.error("[fixtures] capture failed", error);
  process.exitCode = 1;
}
