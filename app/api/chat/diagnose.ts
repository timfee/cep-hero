import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

import type { VectorSearchHit } from "@/lib/upstash/search";
import type { DiagnosisResult } from "@/types/chat";

import { auth } from "@/lib/auth";
import { analyzeConnectorPolicies } from "@/lib/mcp/connector-analysis";
import { CepToolExecutor } from "@/lib/mcp/registry";
import { searchDocs, searchPolicies } from "@/lib/upstash/search";

const DiagnosisSchema = z.object({
  diagnosis: z.string().optional(),
  hypotheses: z
    .array(
      z.object({
        cause: z.string(),
        confidence: z.number().min(0).max(1),
        evidence: z.array(z.string()).optional(),
      })
    )
    .optional(),
  nextSteps: z.array(z.string()).optional(),
  actionsRequiringConfirmation: z.array(z.string()).optional(),
  planSteps: z.array(z.string()).optional(),
  missingQuestions: z
    .array(
      z.object({
        question: z.string(),
        why: z.string().optional(),
        example: z.string().optional(),
      })
    )
    .optional(),
  evidence: z
    .object({
      checks: z
        .array(
          z.object({
            name: z.string(),
            status: z.enum(["pass", "fail", "unknown"]),
            source: z.string().optional(),
            detail: z.string().optional(),
          })
        )
        .optional(),
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
      sources: z.array(z.string()).optional(),
      connectorAnalysis: z
        .object({
          total: z.number(),
          byTarget: z.object({
            customer: z.number(),
            orgUnit: z.number(),
            group: z.number(),
            unknown: z.number(),
          }),
          misScoped: z.number(),
          detail: z.string(),
          flag: z.boolean(),
          sampleTarget: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  reference: z
    .object({
      title: z.string(),
      url: z.string(),
    })
    .optional(),
});

/**
 * Run CEP diagnostics with evidence and optional knowledge grounding.
 */
export async function diagnose(
  req: Request,
  prompt: string
): Promise<DiagnosisResult> {
  const isTestBypass = req.headers.get("x-test-bypass") === "1";

  if (process.env.EVAL_TEST_MODE === "1") {
    return syntheticDiagnosis();
  }

  const session = isTestBypass
    ? { user: { id: "test" } }
    : await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return { error: "Unauthorized" };
  }

  let accessToken = "";
  if (!isTestBypass) {
    try {
      const accessTokenResponse = await auth.api.getAccessToken({
        body: { providerId: "google" },
        headers: req.headers,
      });
      accessToken = accessTokenResponse?.accessToken ?? "";
    } catch (error) {
      return authFailureDiagnosis(error);
    }
  }
  if (isTestBypass) {
    try {
      const { getServiceAccountAccessToken } =
        await import("@/lib/google-service-account");
      accessToken = await getServiceAccountAccessToken(
        [
          "https://www.googleapis.com/auth/admin.directory.user",
          "https://www.googleapis.com/auth/admin.directory.orgunit",
          "https://www.googleapis.com/auth/admin.directory.group",
          "https://www.googleapis.com/auth/admin.reports.audit.readonly",
          "https://www.googleapis.com/auth/chrome.management.policy",
          "https://www.googleapis.com/auth/chrome.management.policy.readonly",
          "https://www.googleapis.com/auth/cloud-identity.policies.readonly",
        ],
        process.env.GOOGLE_TOKEN_EMAIL
      );
    } catch (error) {
      return syntheticDiagnosis("Missing Google access token for live diagnostics.");
    }
  }

  if (!accessToken) {
    return authFailureDiagnosis("Missing Google access token");
  }

  const executor = new CepToolExecutor(accessToken);

  const [eventsResult, dlpResult, connectorResult, docsResult, policyResult] =
    await Promise.all([
      executor.getChromeEvents({ maxResults: 50 }),
      executor.listDLPRules({ includeHelp: false }),
      executor.getChromeConnectorConfiguration(),
      searchDocs(prompt, 1),
      searchPolicies(prompt, 1),
    ]);

  const connectorPolicies =
    "value" in connectorResult && Array.isArray(connectorResult.value)
      ? connectorResult.value
      : [];
  const connectorAnalysis = analyzeConnectorPolicies(connectorPolicies);

  const evidence = buildEvidence({
    eventsResult,
    dlpResult,
    connectorResult,
    connectorAnalysis,
  });

  if (connectorPolicies.length === 0) {
    evidence.gaps = evidence.gaps ?? [];
    evidence.gaps.push({
      missing: "Connector policies",
      why: "No policies returned; check policyTargetKey targeting (orgunits/my_customer) and permissions.",
    });
    evidence.signals = evidence.signals ?? [];
    evidence.signals.push({
      type: "connector-policies",
      source: "Chrome Policy",
      summary:
        "No connector policies returned; ensure policyTargetKey targets an org unit",
    });
  }

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

  const result = await generateObject({
    model: google("gemini-2.0-flash-001"),
    schema: DiagnosisSchema,
    system:
      "You are the CEP troubleshooting assistant. Use evidence to answer. Never invent evidence. If data is missing, say what is missing and ask targeted questions (bundle them). Keep answers concise and action-oriented. If a change is needed, ask for confirmation. Include a plan of what you checked. If referencing docs, only include one Reference line.",
    prompt: `User question: ${prompt}\nEvidence JSON: ${JSON.stringify(evidence)}\nKnowledge: ${JSON.stringify(modelInput.knowledge)}\nGuidelines:\n- Provide a short diagnosis first.\n- Include hypotheses with confidence.\n- Include next steps.\n- Include planSteps (what you checked / will check).\n- If missing info, include missingQuestions with why and example.\n- Summarize; do not dump raw IDs.\n- One Reference line max (title and URL).
- Do not include filesystem paths or console routes like /settings.`,
  });

  return result.object;
}

function syntheticDiagnosis(errorDetail?: string): DiagnosisResult {
  return {
    diagnosis: "Synthetic diagnosis for test runs.",
    nextSteps: ["Review fixtures", "Validate expected schema"],
    planSteps: ["Used test-mode synthetic path"],
    hypotheses: [
      {
        cause: errorDetail ?? "Service account token unavailable",
        confidence: 0.8,
        evidence: errorDetail ? [errorDetail] : undefined,
      },
    ],
    evidence: {
      checks: [
        { name: "test-mode", status: "pass", detail: "Synthetic response" },
      ],
    },
  };
}

function authFailureDiagnosis(errorDetail: unknown): DiagnosisResult {
  const detail =
    errorDetail instanceof Error
      ? errorDetail.message
      : typeof errorDetail === "string"
        ? errorDetail
        : "Failed to obtain Google access token";
  return {
    diagnosis: "Authentication is required to run live diagnostics.",
    nextSteps: [
      "Sign in again and retry the request.",
      "If using a service account, verify domain-wide delegation and scopes.",
    ],
    planSteps: ["Attempted to obtain Google access token"],
    hypotheses: [
      {
        cause: "Missing or expired Google access token",
        confidence: 0.8,
        evidence: [detail],
      },
    ],
    evidence: {
      checks: [
        {
          name: "google-access-token",
          status: "fail",
          detail,
        },
      ],
    },
  };
}

/**
 * Build structured evidence from CEP tool outputs.
 */
function buildEvidence({
  eventsResult,
  dlpResult,
  connectorResult,
  connectorAnalysis,
}: {
  eventsResult: Awaited<ReturnType<CepToolExecutor["getChromeEvents"]>>;
  dlpResult: Awaited<ReturnType<CepToolExecutor["listDLPRules"]>>;
  connectorResult: Awaited<
    ReturnType<CepToolExecutor["getChromeConnectorConfiguration"]>
  >;
  connectorAnalysis: ReturnType<typeof analyzeConnectorPolicies>;
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
  const nextSteps: string[] = [];

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
    const connectorPolicies = Array.isArray(connectorResult.value)
      ? connectorResult.value
      : [];
    const count = connectorPolicies.length;
    checks.push({
      name: "Connector policies",
      status: count > 0 ? "pass" : "unknown",
      source: "Chrome Policy",
      detail: `policies=${count}; ${connectorAnalysis.detail}`,
    });
    if (count > 0) {
      signals.push({
        type: "connector-policies",
        source: "Chrome Policy",
        summary:
          connectorAnalysis.misScoped > 0
            ? `Some connector policies target customers (need org units or groups)`
            : `Resolved ${count} connector policies scoped to org units/groups`,
      });
      if (connectorAnalysis.flag) {
        gaps.push({
          missing: "Connector policies scoped to org units or groups",
          why:
            connectorAnalysis.sampleTarget ??
            "Policies are applied at customer level; must target org units or groups.",
        });
        nextSteps.push(
          "Re-scope connector policies to org units or groups; customer-level targeting is unsupported."
        );
      } else {
        nextSteps.push(
          "Confirm connector policies are applied to the intended org units or groups."
        );
      }
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
    connectorAnalysis,
  };
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
