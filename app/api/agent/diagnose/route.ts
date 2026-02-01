import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

import type { VectorSearchHit } from "@/lib/upstash/search";

import { auth } from "@/lib/auth";
import { CepToolExecutor } from "@/lib/mcp/registry";
import { searchDocs, searchPolicies } from "@/lib/upstash/search";

const DiagnosisSchema = z.object({
  diagnosis: z.string(),
  hypotheses: z.array(
    z.object({
      cause: z.string(),
      confidence: z.number().min(0).max(1),
      evidence: z.array(z.string()),
    })
  ),
  nextSteps: z.array(z.string()),
  actionsRequiringConfirmation: z.array(z.string()).optional(),
  evidence: z.object({
    checks: z.array(
      z.object({
        name: z.string(),
        status: z.enum(["pass", "fail", "unknown"]),
        source: z.string(),
        detail: z.string().optional(),
      })
    ),
    gaps: z
      .array(z.object({ missing: z.string(), why: z.string() }))
      .optional(),
    signals: z
      .array(
        z.object({
          type: z.string(),
          source: z.string(),
          summary: z.string(),
          referenceUrl: z.string().optional(),
        })
      )
      .optional(),
    sources: z.array(z.string()),
  }),
  reference: z
    .object({
      title: z.string(),
      url: z.string(),
    })
    .optional(),
});

/**
 * Run a structured diagnosis for agent usage.
 */
export async function POST(req: Request) {
  const body = await req.json();
  const prompt = getOptionalString(body, "prompt");
  const knowledgeQuery = getOptionalString(body, "knowledgeQuery");

  if (!prompt?.trim()) {
    return Response.json({ error: "Missing prompt" }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessTokenResponse = await auth.api.getAccessToken({
    body: { providerId: "google" },
    headers: req.headers,
  });

  if (!accessTokenResponse?.accessToken) {
    return Response.json(
      { error: "Missing Google access token" },
      { status: 401 }
    );
  }

  const executor = new CepToolExecutor(accessTokenResponse.accessToken);

  const [eventsResult, dlpResult, connectorResult, docsResult, policyResult] =
    await Promise.all([
      executor.getChromeEvents({ maxResults: 25 }),
      executor.listDLPRules({ includeHelp: false }),
      executor.getChromeConnectorConfiguration(),
      searchDocs(knowledgeQuery ?? prompt, 1),
      searchPolicies(knowledgeQuery ?? prompt, 1),
    ]);

  const evidence = buildEvidence({ eventsResult, dlpResult, connectorResult });

  const knowledgeReference = docsResult.hits[0] ?? policyResult.hits[0];

  const modelInput = {
    prompt,
    evidence,
    knowledge: knowledgeReference
      ? {
          title:
            getMetadataString(knowledgeReference, "title") ??
            String(knowledgeReference.id),
          url: getMetadataString(knowledgeReference, "url"),
          score: knowledgeReference.score,
        }
      : null,
  };

  try {
    const result = await generateObject({
      model: google("gemini-2.0-flash-001"),
      schema: DiagnosisSchema,
      system:
        "You are the CEP troubleshooting assistant. Use evidence to answer. Never invent evidence. If data is missing, say what is missing and ask a targeted question. Keep answers concise and action-oriented. If a change is needed, ask for confirmation.",
      prompt: `User question: ${prompt}\nEvidence JSON: ${JSON.stringify(evidence)}\nKnowledge: ${JSON.stringify(modelInput.knowledge)}\nProduce a concise diagnosis. If you lack evidence, say what is missing. Do not dump raw IDs; summarize them.`,
    });

    return Response.json(result.object);
  } catch (error) {
    console.warn("[agent-diagnose] model error", {
      message: getErrorMessage(error),
    });
    return Response.json(
      {
        diagnosis: "I could not synthesize a full answer due to a model error.",
        hypotheses: [],
        nextSteps: ["Re-run with more context", "Check Chrome Policy scope"],
        actionsRequiringConfirmation: [],
        evidence,
      },
      { status: 200 }
    );
  }
}

/**
 * Build structured evidence from CEP tool outputs.
 */
function buildEvidence({
  eventsResult,
  dlpResult,
  connectorResult,
}: {
  eventsResult: Awaited<ReturnType<CepToolExecutor["getChromeEvents"]>>;
  dlpResult: Awaited<ReturnType<CepToolExecutor["listDLPRules"]>>;
  connectorResult: Awaited<
    ReturnType<CepToolExecutor["getChromeConnectorConfiguration"]>
  >;
}) {
  const checks: Array<{
    name: string;
    status: "pass" | "fail" | "unknown";
    source: string;
    detail?: string;
  }> = [];

  const gaps: Array<{ missing: string; why: string }> = [];
  const signals: Array<{
    type: string;
    source: string;
    summary: string;
    referenceUrl?: string;
  }> = [];

  if ("events" in eventsResult) {
    const count = eventsResult.events?.length ?? 0;
    checks.push({
      name: "Chrome events",
      status: count > 0 ? "pass" : "unknown",
      source: "Admin SDK Reports",
      detail: `events=${count}`,
    });
    if (count > 0) {
      const latest = eventsResult.events?.[0];
      signals.push({
        type: "events",
        source: "Admin SDK Reports",
        summary: `Latest event: ${latest?.id?.uniqueQualifier ?? "n/a"}`,
      });
    }
  } else if ("error" in eventsResult) {
    checks.push({
      name: "Chrome events",
      status: "unknown",
      source: "Admin SDK Reports",
      detail: eventsResult.error,
    });
    gaps.push({ missing: "Chrome events", why: eventsResult.error });
  }

  if ("rules" in dlpResult) {
    const count = dlpResult.rules?.length ?? 0;
    checks.push({
      name: "DLP rules",
      status: count > 0 ? "pass" : "fail",
      source: "Cloud Identity",
      detail: `rules=${count}`,
    });
    if (count > 0) {
      signals.push({
        type: "dlp-rules",
        source: "Cloud Identity",
        summary: `Example rule: ${dlpResult.rules?.[0]?.displayName ?? dlpResult.rules?.[0]?.id ?? "n/a"}`,
        referenceUrl: dlpResult.rules?.[0]?.consoleUrl,
      });
    }
  } else if ("error" in dlpResult) {
    checks.push({
      name: "DLP rules",
      status: "unknown",
      source: "Cloud Identity",
      detail: dlpResult.error,
    });
    gaps.push({ missing: "DLP rules", why: dlpResult.error });
  }

  if ("value" in connectorResult) {
    const count = connectorResult.value?.length ?? 0;
    checks.push({
      name: "Connector policies",
      status: count > 0 ? "pass" : "unknown",
      source: "Chrome Policy",
      detail: `policies=${count}`,
    });
    if (count > 0) {
      signals.push({
        type: "connector-policies",
        source: "Chrome Policy",
        summary: `Resolved ${count} connector policies`,
      });
    }
  } else if ("error" in connectorResult) {
    checks.push({
      name: "Connector policies",
      status: "unknown",
      source: "Chrome Policy",
      detail: connectorResult.error,
    });
    gaps.push({ missing: "Connector policies", why: connectorResult.error });
  }

  return {
    checks,
    gaps,
    signals,
    sources: ["Admin SDK Reports", "Cloud Identity", "Chrome Policy"],
  };
}

/**
 * Read a string property from a JSON body.
 */
function getOptionalString(body: unknown, key: string): string | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const value = Reflect.get(body, key);
  return typeof value === "string" ? value : undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  const message =
    error && typeof error === "object"
      ? Reflect.get(error, "message")
      : undefined;

  return typeof message === "string" ? message : "Unknown error";
}

/**
 * Extract a string field from vector search metadata.
 */
function getMetadataString(
  hit: VectorSearchHit,
  key: "title" | "url"
): string | undefined {
  const value = hit.metadata?.[key];
  return typeof value === "string" ? value : undefined;
}
