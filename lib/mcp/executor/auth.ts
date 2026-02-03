/**
 * OAuth token validation utilities for debugging authentication issues.
 */

import { type OAuth2Client } from "google-auth-library";

import { getErrorMessage } from "@/lib/mcp/errors";

interface TokenInfo {
  scope?: string;
  expires_in?: number;
  issued_to?: string;
  audience?: string;
  email?: string;
  access_type?: string;
  error?: string;
}

/**
 * Type guard for tokeninfo API response shape.
 */
function isValidTokenInfo(data: unknown): data is TokenInfo {
  return typeof data === "object" && data !== null;
}

/**
 * Validates the current OAuth access token by querying Google's tokeninfo
 * endpoint. Returns scopes, expiry, and email on success.
 */
export async function debugAuth(auth: OAuth2Client) {
  const token = await auth.getAccessToken();
  const accessToken = token?.token;

  if (typeof accessToken !== "string" || accessToken.length === 0) {
    return { error: "No access token available in client" };
  }

  return fetchTokenInfo(accessToken);
}

/**
 * Calls Google's tokeninfo endpoint to validate the token.
 */
async function fetchTokenInfo(accessToken: string) {
  try {
    const url = `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const data: unknown = await res.json();

    if (!isValidTokenInfo(data)) {
      return { error: "Invalid tokeninfo response" };
    }

    if (!res.ok || typeof data.error === "string") {
      return { error: data.error ?? `tokeninfo ${res.status}` };
    }

    return {
      scopes: parseScopes(data.scope),
      expiresIn: data.expires_in ?? 0,
      email: data.email,
      accessType: data.access_type,
    };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

/**
 * Splits the space-delimited scope string into an array.
 */
function parseScopes(scope: string | undefined) {
  if (typeof scope !== "string" || scope.length === 0) {
    return [];
  }
  return scope.split(" ").filter((s) => s.length > 0);
}
