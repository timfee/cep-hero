/**
 * Configuration and utilities for the default user auto-sign-in feature.
 * When USE_DEFAULT_USER is enabled, the app automatically signs in as the
 * delegated admin (GOOGLE_TOKEN_EMAIL) without requiring OAuth.
 */

/**
 * Whether the default user mode is enabled via environment variable.
 */
export function isDefaultUserEnabled(): boolean {
  const value = process.env.USE_DEFAULT_USER;
  return value === "true" || value === "1";
}

/**
 * Get the default user's email address from GOOGLE_TOKEN_EMAIL.
 * Returns null if USE_DEFAULT_USER is not enabled or email is not configured.
 */
export function getDefaultUserEmail(): string | null {
  if (!isDefaultUserEnabled()) {
    return null;
  }

  const email = process.env.GOOGLE_TOKEN_EMAIL;
  if (!email) {
    return null;
  }

  return email.replaceAll(/^['"]|['"]$/g, "");
}
