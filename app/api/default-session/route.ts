/**
 * API route to check if default user mode is active.
 * Returns the default user configuration when USE_DEFAULT_USER is enabled.
 */

import { getDefaultUserEmail, isDefaultUserEnabled } from "@/lib/default-user";

/**
 * Response shape for the default session endpoint.
 */
interface DefaultSessionResponse {
  enabled: boolean;
  user?: {
    name: string;
    email: string;
  };
}

/**
 * Returns default user info when USE_DEFAULT_USER is enabled.
 */
export function GET(): Response {
  if (!isDefaultUserEnabled()) {
    return Response.json({ enabled: false } satisfies DefaultSessionResponse);
  }

  const email = getDefaultUserEmail();
  if (!email) {
    return Response.json({ enabled: false } satisfies DefaultSessionResponse);
  }

  return Response.json({
    enabled: true,
    user: {
      name: "Default Admin",
      email,
    },
  } satisfies DefaultSessionResponse);
}
