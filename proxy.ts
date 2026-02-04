/**
 * Authentication proxy middleware for protected routes.
 */

import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";

/**
 * Redirects unauthenticated users to sign-in page.
 */
export async function proxy(request: NextRequest) {
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
    "/((?!api|_next/static|_next/image|sign-in|gimme|favicon.ico|icon.png).*)",
  ],
};
