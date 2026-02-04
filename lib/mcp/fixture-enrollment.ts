/**
 * Enrollment token resolution for fixture-based testing.
 */

import { type EnrollBrowserResult } from "./executor/enrollment";

const DEFAULT_TOKEN = "fixture-enrollment-token-12345";

/**
 * Shape of enrollment token fixture data.
 */
interface EnrollmentTokenFixture {
  token?: string;
  expiresAt?: string | null;
  targetResource?: string;
  status?: "valid" | "expired" | "revoked";
  error?: string;
}

/**
 * Resolves enrollment token from fixture data. Returns either a success
 * response with the token or an error response based on fixture status.
 */
export function resolveEnrollmentToken(
  fixture: EnrollmentTokenFixture | undefined
): EnrollBrowserResult {
  if (fixture === undefined) {
    return {
      enrollmentToken: DEFAULT_TOKEN,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  const statusError = getStatusError(fixture.status);
  if (statusError !== null) {
    return statusError;
  }

  if (typeof fixture.error === "string") {
    return {
      error: fixture.error,
      suggestion: "Check enrollment token configuration.",
      requiresReauth: false,
    };
  }

  return {
    enrollmentToken: fixture.token ?? DEFAULT_TOKEN,
    expiresAt: fixture.expiresAt ?? null,
  };
}

/**
 * Returns an error result for expired or revoked token status.
 */
function getStatusError(
  status: EnrollmentTokenFixture["status"]
): EnrollBrowserResult | null {
  if (status === "expired") {
    return {
      error: "Enrollment token has expired",
      suggestion: "Generate a new enrollment token.",
      requiresReauth: false,
    };
  }
  if (status === "revoked") {
    return {
      error: "Enrollment token has been revoked",
      suggestion: "Generate a new enrollment token.",
      requiresReauth: false,
    };
  }
  return null;
}
