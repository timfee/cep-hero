/**
 * Configuration and utilities for the default user auto-sign-in feature.
 * When USE_DEFAULT_USER is enabled, the app automatically signs in as the
 * delegated admin (GOOGLE_TOKEN_EMAIL) without requiring OAuth.
 *
 * WARNING: This disables OAuth authentication entirely. Only use in
 * development or controlled demo environments, never in production.
 */

import { getServiceAccountAccessToken } from "@/lib/google-service-account";

/**
 * Scopes authorized for domain-wide delegation in the Admin Console.
 * Every scope here must also be listed in the Admin Console under
 * Security > API controls > Domain-wide Delegation. Requesting any
 * unauthorized scope causes the entire token request to fail with
 * unauthorized_client.
 *
 * See README.md "Authorize in Admin Console" for the canonical list.
 */
const DEFAULT_USER_SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.user",
  "https://www.googleapis.com/auth/admin.directory.orgunit",
  "https://www.googleapis.com/auth/admin.directory.group",
  "https://www.googleapis.com/auth/admin.reports.audit.readonly",
  "https://www.googleapis.com/auth/chrome.management.policy",
  "https://www.googleapis.com/auth/chrome.management.policy.readonly",
  "https://www.googleapis.com/auth/chrome.management.reports.readonly",
  "https://www.googleapis.com/auth/chrome.management.profiles.readonly",
  "https://www.googleapis.com/auth/cloud-identity.policies",
  "https://www.googleapis.com/auth/cloud-identity.policies.readonly",
  "https://www.googleapis.com/auth/cloud-platform",
];

/**
 * Whether the default user mode is enabled via environment variable.
 * Returns false if GOOGLE_TOKEN_EMAIL is not set, since the feature
 * requires a delegation target to obtain access tokens.
 */
export function isDefaultUserEnabled(): boolean {
  const value = process.env.USE_DEFAULT_USER;
  if (value !== "true" && value !== "1") {
    return false;
  }

  if (!process.env.GOOGLE_TOKEN_EMAIL) {
    console.error(
      "[default-user] USE_DEFAULT_USER is enabled but GOOGLE_TOKEN_EMAIL is not set. Falling back to OAuth."
    );
    return false;
  }

  return true;
}

/**
 * Get the default user's email address from GOOGLE_TOKEN_EMAIL.
 * Returns null if default user mode is not enabled.
 */
export function getDefaultUserEmail(): string | null {
  if (!isDefaultUserEnabled()) {
    return null;
  }

  const email = process.env.GOOGLE_TOKEN_EMAIL ?? "";
  return email.replaceAll(/^['"]|['"]$/g, "");
}

/**
 * Get a Google access token for the default user via service account
 * domain-wide delegation. Returns null if default user mode is not enabled
 * or credentials are not configured.
 */
export async function getDefaultUserAccessToken(): Promise<string | null> {
  const email = getDefaultUserEmail();
  if (!email) {
    return null;
  }

  try {
    return await getServiceAccountAccessToken(DEFAULT_USER_SCOPES, email);
  } catch (error) {
    console.error(
      "[default-user] Failed to get service account access token:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return null;
  }
}
