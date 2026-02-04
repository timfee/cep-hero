/**
 * Google service account authentication utilities for domain-wide delegation.
 */

import { JWT } from "google-auth-library";

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

/**
 * Load and validate service account credentials from environment.
 */
function loadServiceAccount() {
  const json = getServiceAccountJson();
  const parsed = parseServiceAccountJson(json);
  return normalizeCredentials(parsed);
}

/**
 * Retrieve raw service account JSON from environment variable.
 */
function getServiceAccountJson() {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (inline === undefined || inline === "") {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_JSON env for service account credentials"
    );
  }
  return inline.replaceAll(/^['"]|['"]$/g, "");
}

/**
 * Parse and validate JSON structure as an object.
 */
function parseServiceAccountJson(json: string) {
  const parsed: unknown = JSON.parse(json);
  if (!isPlainObject(parsed)) {
    throw new Error("Service account JSON must be an object");
  }
  return parsed;
}

/**
 * Normalize credentials and fix escaped newlines in private key.
 */
function normalizeCredentials(
  parsed: Record<string, unknown>
): ServiceAccountCredentials {
  if (!hasValidCredentials(parsed)) {
    throw new Error("Service account JSON missing client_email or private_key");
  }

  const key = parsed.private_key.includes(String.raw`\n`)
    ? parsed.private_key.replaceAll(String.raw`\n`, "\n")
    : parsed.private_key;

  return { client_email: parsed.client_email, private_key: key };
}

/**
 * Type guard for valid service account credential structure.
 */
function hasValidCredentials(
  parsed: Record<string, unknown>
): parsed is { client_email: string; private_key: string } {
  return (
    typeof parsed.client_email === "string" &&
    parsed.client_email.length > 0 &&
    typeof parsed.private_key === "string" &&
    parsed.private_key.length > 0
  );
}

/**
 * Obtain an access token for the service account with domain-wide delegation.
 */
export async function getServiceAccountAccessToken(
  scopes: string[],
  subject?: string
) {
  const { client_email, private_key } = loadServiceAccount();
  const jwt = new JWT({
    email: client_email,
    key: private_key,
    scopes,
    subject,
  });
  const result = await jwt.authorize();
  if (typeof result.access_token !== "string" || result.access_token === "") {
    throw new Error("Failed to obtain service account access token");
  }
  return result.access_token;
}

/**
 * Get the subject email for impersonation, falling back to the provided default.
 */
export function getServiceAccountSubject(defaultEmail: string) {
  const envEmail = process.env.GOOGLE_TOKEN_EMAIL;
  if (envEmail === undefined || envEmail === "") {
    return defaultEmail;
  }
  return envEmail.replaceAll(/^['"]|['"]$/g, "");
}

/**
 * Type guard for plain objects.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
