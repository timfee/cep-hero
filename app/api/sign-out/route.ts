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
  try {
    await revokeTokenIfPresent(req);
    await clearAuthCookies();
    return Response.json({ success: true, message: "Signed out successfully" });
  } catch (error) {
    console.log(
      "[sign-out] Error:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return Response.json(
      { success: false, error: "Failed to sign out" },
      { status: 500 }
    );
  }
}
