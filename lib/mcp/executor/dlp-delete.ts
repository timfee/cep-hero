/**
 * Cloud Identity DLP rule deletion for test teardown and admin operations.
 */

import { type OAuth2Client } from "google-auth-library";

import { type ApiErrorResponse } from "@/lib/mcp/errors";

/**
 * Result of deleting a DLP rule.
 */
export type DeleteDLPRuleResult =
  | { success: true; deletedRule: string }
  | ApiErrorResponse;

/**
 * Deletes a DLP rule from Cloud Identity by resource name.
 * Used primarily for test teardown.
 */
export async function deleteDLPRule(
  auth: OAuth2Client,
  resourceName: string
): Promise<DeleteDLPRuleResult> {
  console.log("[dlp-delete] request", { resourceName });

  const accessToken = await getAccessToken(auth);
  if (accessToken === null) {
    return {
      error: "No access token available",
      suggestion: "Authentication required to delete DLP rules.",
      requiresReauth: true,
    };
  }

  try {
    const res = await fetch(
      `https://cloudidentity.googleapis.com/v1beta1/${resourceName}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const errorMessage =
        (data as { error?: { message?: string } })?.error?.message ??
        `HTTP ${res.status}`;
      console.log("[dlp-delete] error", { status: res.status, errorMessage });
      return {
        error: errorMessage,
        suggestion:
          "Check that the rule exists and you have delete permissions.",
        requiresReauth: res.status === 401 || res.status === 403,
      };
    }

    console.log("[dlp-delete] success", { resourceName });
    return { success: true, deletedRule: resourceName };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.log("[dlp-delete] error", { message });
    return {
      error: message,
      suggestion: "Check network connectivity and try again.",
      requiresReauth: false,
    };
  }
}

/**
 * Extracts the access token from the OAuth client.
 */
async function getAccessToken(auth: OAuth2Client) {
  const token = await auth.getAccessToken();
  const accessToken = token?.token;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    return null;
  }
  return accessToken;
}
