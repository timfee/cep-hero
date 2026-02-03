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

/**
 * Debug the current access token scopes and expiry.
 */
export async function debugAuth(auth: OAuth2Client): Promise<DebugAuthResult> {
  const token = await auth.getAccessToken();
  const accessToken = token?.token;

  if (accessToken === undefined) {
    return { error: "No access token available in client" };
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
    );
    const data = (await res.json()) as TokenInfo;

    if (!res.ok || data.error !== undefined) {
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
