import { type OAuth2Client } from "google-auth-library";

import { getErrorMessage } from "@/lib/mcp/errors";

interface DebugAuthSuccess {
  scope: string;
  expiresIn?: number;
  issuedTo?: string;
}

interface DebugAuthError {
  error: string;
}

export type DebugAuthResult = DebugAuthSuccess | DebugAuthError;

interface TokenInfo {
  scope?: string;
  expires_in?: number;
  issued_to?: string;
  audience?: string;
  error?: string;
}

function isValidTokenInfo(data: unknown): data is TokenInfo {
  return typeof data === "object" && data !== null;
}

/**
 * Validates the current OAuth access token by querying Google's tokeninfo
 * endpoint. Returns scope, expiry, and issuer on success.
 */
export async function debugAuth(auth: OAuth2Client): Promise<DebugAuthResult> {
  const token = await auth.getAccessToken();
  const accessToken = token?.token;

  if (typeof accessToken !== "string" || accessToken.length === 0) {
    return { error: "No access token available in client" };
  }

  return fetchTokenInfo(accessToken);
}

async function fetchTokenInfo(accessToken: string): Promise<DebugAuthResult> {
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
      scope: data.scope ?? "",
      expiresIn: data.expires_in,
      issuedTo: data.issued_to ?? data.audience,
    };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}
