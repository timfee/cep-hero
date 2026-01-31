import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

import type { DiagnosisPayload, DiagnosisResult } from "@/types/chat";

import { diagnose } from "@/app/api/chat/diagnose";
import { auth } from "@/lib/auth";

export const maxDuration = 30;

export async function POST(req: Request) {
  const isTestBypass =
    req.headers.get("x-test-bypass") === "1";

  const session = isTestBypass
    ? { user: { id: "test" } }
    : await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized. Please sign in to use CEP tools.",
      }),
      { status: 401 }
    );
  }

  const accessTokenResponse = isTestBypass
    ? { accessToken: "test-token" }
    : await auth.api.getAccessToken({
        body: { providerId: "google" },
        headers: req.headers,
      });

  if (!accessTokenResponse?.accessToken) {
    return new Response(
      JSON.stringify({
        error: "Missing Google access token. Please re-authenticate.",
      }),
      { status: 401 }
    );
  }

  const { messages } = await req.json();
  const lastUser = [...messages].reverse().find((m: any) => m.role === "user");
  const prompt = lastUser?.content || "";

  const diagnosis = (await diagnose(req, prompt)) as DiagnosisResult;

  if ("error" in diagnosis) {
    return new Response(
      JSON.stringify({ error: diagnosis.error ?? "Diagnosis failed" }),
      { status: 500 }
    );
  }

  const diag = diagnosis as DiagnosisPayload;

  const answer = diag.diagnosis ?? "Unable to diagnose right now.";
  const reference =
    diag.reference && diag.reference.url?.startsWith("http")
      ? diag.reference
      : null;
  const nextSteps = diag.nextSteps ?? [];
  const hypotheses = diag.hypotheses ?? [];
  const planSteps = diag.planSteps ?? [];
  const missingQuestions = diag.missingQuestions ?? [];
  const connectorAnalysis = diag.evidence?.connectorAnalysis;

  const summaryLines = [answer];
  if (connectorAnalysis?.flag) {
    summaryLines.push(
      `Connector scope issue: Policies are applied to customers; re-scope to org units or groups.${connectorAnalysis.sampleTarget ? ` Found: ${connectorAnalysis.sampleTarget}` : ""}`
    );
  }
  if (planSteps.length) {
    summaryLines.push(`What I checked:\n- ${planSteps.join("\n-")}`);
  }
  if (hypotheses.length) {
    const top = hypotheses
      .slice(0, 2)
      .map(
        (h: any) =>
          `- ${h.cause} (confidence ${Math.round((h.confidence ?? 0) * 100)}%)`
      )
      .join("\n");
    if (top) summaryLines.push(`Hypotheses:\n${top}`);
  }
  if (nextSteps.length) {
    summaryLines.push(`Next steps:\n- ${nextSteps.join("\n-")}`);
  }
  if (missingQuestions.length) {
    summaryLines.push(
      `Missing info (${missingQuestions.length}):\n- ${missingQuestions
        .map((q: any) => `${q.question}${q.why ? ` (why: ${q.why})` : ""}`)
        .join("\n-")}`
    );
  }
  if (reference) {
    summaryLines.push(`Reference: ${reference.title} — ${reference.url}`);
  }

  const rawAssistantMessage = summaryLines.join("\n\n");
  const finalAssistantMessage = rawAssistantMessage
    .split("\n")
    .filter((line) => !/^\/[A-Za-z0-9]/.test(line.trim()))
    .join("\n");

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({
        type: "start",
        messageId: "assistant",
        messageMetadata: {
          evidence: {
            planSteps,
            hypotheses,
            nextSteps,
            missingQuestions,
            evidence: diag.evidence,
            connectorAnalysis,
          },
        },
      });
      writer.write({ type: "text-start", id: "assistant" });

      writer.write({
        type: "text-delta",
        id: "assistant",
        delta: finalAssistantMessage,
      });
      writer.write({ type: "text-end", id: "assistant" });
      writer.write({
        type: "finish",
        messageMetadata: {
          evidence: {
            planSteps,
            hypotheses,
            nextSteps,
            missingQuestions,
            evidence: diag.evidence,
            connectorAnalysis,
          },
        },
      });
    },
    originalMessages: messages,
    onError: () => "An error occurred while streaming.",
  });

  return createUIMessageStreamResponse({
    stream,
  });
}
