/**
 * Catch-all authentication route handler for Better Auth.
 * Delegates all auth-related requests to the Better Auth library.
 */

import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth);
