/**
 * Overview API route providing fleet status data for the dashboard.
 * Authenticates the request and fetches overview data from Google APIs.
 * Falls back to service account access when default user mode is enabled.
 */

import { auth } from "@/lib/auth";
import { getDefaultUserAccessToken } from "@/lib/default-user";
import { CepToolExecutor } from "@/lib/mcp/registry";

/**
 * Resolve a Google access token from the user's OAuth session,
 * falling back to the default user's service account token.
 */
async function resolveAccessToken(req: Request): Promise<string | null> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (session) {
    const tokenResponse = await auth.api.getAccessToken({
      body: { providerId: "google" },
      headers: req.headers,
    });
    if (tokenResponse?.accessToken) {
      return tokenResponse.accessToken;
    }
  }

  return await getDefaultUserAccessToken();
}

/**
 * Fetch fleet overview data for the authenticated user.
 */
export async function GET(req: Request) {
  const accessToken = await resolveAccessToken(req);
  if (!accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const executor = new CepToolExecutor(accessToken);
  const overview = await executor.getFleetOverview({});

  return Response.json(overview);
}
