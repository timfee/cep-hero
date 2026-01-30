import { auth } from "@/lib/auth";
import { searchDocs, searchPolicies } from "@/lib/upstash/search";

export async function POST(req: Request) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    query?: string;
    scope?: "docs" | "policies";
    topK?: number;
  };

  if (!body.query) {
    return Response.json({ error: "Missing query" }, { status: 400 });
  }

  const topK = body.topK ?? 4;

  const result =
    body.scope === "policies"
      ? await searchPolicies(body.query, topK)
      : await searchDocs(body.query, topK);

  return Response.json(result);
}
