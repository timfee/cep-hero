/**
 * Authentication proxy middleware for protected routes.
 * Allows default user mode to bypass OAuth session checks.
 */

import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { isDefaultUserEnabled } from "@/lib/default-user";

/**
 * Redirects unauthenticated users to sign-in page.
 * Skips the check when USE_DEFAULT_USER is enabled.
 */
export async function proxy(request: NextRequest) {
  if (isDefaultUserEnabled()) {
    return NextResponse.next();
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|sign-in|favicon.ico|icon.png).*)",
  ],
};
