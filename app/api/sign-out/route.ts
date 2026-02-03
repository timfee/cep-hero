import { cookies } from "next/headers";

import { auth } from "@/lib/auth";

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

function isAuthCookie(name: string): boolean {
  return (
    name.startsWith("better-auth") ||
    name.includes("session") ||
    name.includes("account")
  );
}

async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (isAuthCookie(cookie.name)) {
      cookieStore.delete(cookie.name);
    }
  }
}

async function revokeTokenIfPresent(req: Request): Promise<void> {
  const tokenResponse = await auth.api.getAccessToken({
    body: { providerId: "google" },
    headers: req.headers,
  });
  if (tokenResponse?.accessToken) {
    await revokeGoogleToken(tokenResponse.accessToken);
  }
}

export async function POST(req: Request): Promise<Response> {
  let revocationError: Error | null = null;

  try {
    await revokeTokenIfPresent(req);
  } catch (error) {
    revocationError =
      error instanceof Error ? error : new Error("Token revocation failed");
    console.log("[sign-out] Revocation error:", revocationError.message);
  }

  try {
    await clearAuthCookies();
  } catch (error) {
    console.log(
      "[sign-out] Cookie clear error:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return Response.json(
      { success: false, error: "Failed to clear session" },
      { status: 500 }
    );
  }

  return Response.json({ success: true, message: "Signed out successfully" });
}
