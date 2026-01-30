import { auth } from "@/lib/auth";
import { CepToolExecutor } from "@/lib/mcp/registry";

export async function GET(req: Request) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessTokenResponse = await auth.api.getAccessToken({
    body: {
      providerId: "google",
    },
    headers: req.headers,
  });

  if (!accessTokenResponse?.accessToken) {
    return Response.json(
      { error: "Missing Google access token" },
      { status: 401 }
    );
  }

  const executor = new CepToolExecutor(accessTokenResponse.accessToken);
  const overview = await executor.getFleetOverview({});

  return Response.json(overview);
}
