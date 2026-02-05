/**
 * Sign-out API route. Revokes the Google OAuth token and clears the
 * BetterAuth session. In default user mode, this is a no-op since
 * there is no OAuth session to clear.
 */

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { isDefaultUserEnabled } from "@/lib/default-user";

/**
 * Revokes Google OAuth token.
 */
async function revokeGoogleToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`,
      { method: "POST" }
    );
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Sign-out API route using Better Auth's signOut method.
 * Returns a no-op success when in default user mode.
 */
export async function POST(req: Request): Promise<Response> {
  // In default user mode there is no OAuth session to revoke
  if (isDefaultUserEnabled()) {
    return Response.json({ success: true, message: "Signed out successfully" });
  }

  // Try to revoke Google token first
  try {
    const tokenResponse = await auth.api.getAccessToken({
      body: { providerId: "google" },
      headers: req.headers,
    });
    if (tokenResponse?.accessToken) {
      await revokeGoogleToken(tokenResponse.accessToken);
    }
  } catch (error) {
    console.log(
      "[sign-out] Token revocation error:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  // Use Better Auth's signOut to properly clear the session
  try {
    await auth.api.signOut({
      headers: await headers(),
    });
  } catch (error) {
    console.log(
      "[sign-out] Better Auth signOut error:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return Response.json(
      { success: false, error: "Failed to sign out" },
      { status: 500 }
    );
  }

  return Response.json({ success: true, message: "Signed out successfully" });
}
