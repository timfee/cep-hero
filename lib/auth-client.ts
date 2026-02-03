/**
 * Client-side authentication utilities using Better Auth React bindings.
 */

import { createAuthClient } from "better-auth/react";

/**
 * Better Auth client instance for React components.
 */
export const authClient = createAuthClient({});

export const { signIn, signOut, signUp, useSession } = authClient;
