/**
 * Google service account authentication utilities for domain-wide delegation.
 */

import { JWT } from "google-auth-library";

import { stripQuotes } from "@/lib/gimme/validation";
import { isPlainObject } from "@/lib/utils";

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
  if (!inline) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_JSON env for service account credentials"
    );
  }
  return stripQuotes(inline) ?? inline;
}

/**
 * Parse and validate JSON structure as an object.
 * Handles the case where env parsers convert \n to actual newlines,
 * which breaks JSON parsing of the private_key field.
 */
function parseServiceAccountJson(json: string) {
  // First try parsing as-is (works for pretty-printed and properly escaped JSON)
  try {
    const parsed: unknown = JSON.parse(json);
    if (!isPlainObject(parsed)) {
      throw new Error("Service account JSON must be an object");
    }
    return parsed;
  } catch {
    // If parsing fails, it might be because Bun's env parser converted \n to
    // actual newlines inside the private_key string. Convert them back.
    const fixedJson = json.replaceAll("\n", String.raw`\n`);
    const parsed: unknown = JSON.parse(fixedJson);
    if (!isPlainObject(parsed)) {
      throw new Error("Service account JSON must be an object");
    }
    return parsed;
  }
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
  if (!result.access_token || typeof result.access_token !== "string") {
    throw new Error("Failed to obtain service account access token");
  }
  return result.access_token;
}

/**
 * Get the subject email for impersonation, falling back to the provided default.
 */
export function getServiceAccountSubject(defaultEmail: string) {
  const envEmail = process.env.GOOGLE_TOKEN_EMAIL;
  if (!envEmail) {
    return defaultEmail;
  }
  return stripQuotes(envEmail) ?? defaultEmail;
}
