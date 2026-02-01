import { auth } from "@/lib/auth";
import { searchDocs, searchPolicies } from "@/lib/upstash/search";

export async function POST(req: Request) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const query = getOptionalString(body, "query");
  const scope = getOptionalString(body, "scope");
  const topK = getOptionalNumber(body, "topK") ?? 4;

  if (!query) {
    return Response.json({ error: "Missing query" }, { status: 400 });
  }

  const result =
    scope === "policies"
      ? await searchPolicies(query, topK)
      : await searchDocs(query, topK);

  return Response.json(result);
}

/**
 * Read a string property from a JSON body.
 */
function getOptionalString(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const property = Reflect.get(value, key);
  return typeof property === "string" ? property : undefined;
}

/**
 * Read a number property from a JSON body.
 */
function getOptionalNumber(value: unknown, key: string): number | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const property = Reflect.get(value, key);
  return typeof property === "number" ? property : undefined;
}
