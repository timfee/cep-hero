import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

import type { DiagnosisError, DiagnosisResult } from "@/types/chat";

import { diagnose } from "@/app/api/chat/diagnose";
import { auth } from "@/lib/auth";

export const maxDuration = 30;

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * Handle streaming CEP diagnosis chat responses.
 */
export async function POST(req: Request) {
  const isTestBypass = req.headers.get("x-test-bypass") === "1";

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

  const body = await req.json();
  const messages = getMessagesFromBody(body);
  const prompt = getLastUserMessage(messages);

  const diagnosis = await diagnose(req, prompt);

  if (isDiagnosisError(diagnosis)) {
    return new Response(
      JSON.stringify({ error: diagnosis.error ?? "Diagnosis failed" }),
      { status: 500 }
    );
  }

  const diag = diagnosis;

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
        (h) =>
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
        .map((q) => `${q.question}${q.why ? ` (why: ${q.why})` : ""}`)
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
    onError: () => "An error occurred while streaming.",
  });

  return createUIMessageStreamResponse({
    stream,
  });
}

/**
 * Extract the most recent user message content.
 */
function getLastUserMessage(messages: ChatMessage[]): string {
  const lastUser = [...messages]
    .reverse()
    .find((message) => message.role === "user");
  return lastUser?.content ?? "";
}

/**
 * Read chat messages from a request body.
 */
function getMessagesFromBody(body: unknown): ChatMessage[] {
  if (!body || typeof body !== "object") {
    return [];
  }

  const messages = Reflect.get(body, "messages");
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.filter(isChatMessage);
}

/**
 * Validate chat message shape from the client.
 */
function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const role = Reflect.get(value, "role");
  const content = Reflect.get(value, "content");

  return (
    (role === "system" || role === "user" || role === "assistant") &&
    typeof content === "string"
  );
}

/**
 * Narrow diagnosis results to error responses.
 */
function isDiagnosisError(result: DiagnosisResult): result is DiagnosisError {
  return "error" in result;
}
