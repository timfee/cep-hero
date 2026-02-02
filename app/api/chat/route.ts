import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

import type { DiagnosisError, DiagnosisResult } from "@/types/chat";

import { diagnose } from "@/app/api/chat/diagnose";
import { auth } from "@/lib/auth";

export const maxDuration = 30;
const EVAL_TEST_MODE_ENABLED = process.env.EVAL_TEST_MODE === "1";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * Handle streaming CEP diagnosis chat responses.
 */
export async function POST(req: Request) {
  const isTestBypass = req.headers.get("x-test-bypass") === "1";
  const isEvalTestModeRequest = req.headers.get("x-eval-test-mode") === "1";
  const isEvalTestMode =
    EVAL_TEST_MODE_ENABLED && (isEvalTestModeRequest || isTestBypass);

  if (isEvalTestMode) {
    return createTestModeResponse();
  }

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

  let accessTokenResponse: { accessToken?: string } | undefined;
  if (isTestBypass) {
    accessTokenResponse = { accessToken: "test-token" };
  } else {
    try {
      accessTokenResponse = await auth.api.getAccessToken({
        body: { providerId: "google" },
        headers: req.headers,
      });
    } catch (error) {
      if (EVAL_TEST_MODE_ENABLED) {
        return createTestModeResponse();
      }
      return new Response(
        JSON.stringify({ error: "Failed to fetch Google access token" }),
        { status: 401 }
      );
    }
  }

  if (!accessTokenResponse?.accessToken) {
    if (EVAL_TEST_MODE_ENABLED) {
      return createTestModeResponse();
    }
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
  const actions = [
    {
      id: "retry-connector-fetch",
      label: "Retry connector fetch",
      command: "retry connector fetch",
      primary: true,
    },
    {
      id: "list-connector-policies",
      label: "List connector policies",
      command: "list connector policies",
    },
    {
      id: "check-org-units",
      label: "Check org units",
      command: "list org units",
    },
    {
      id: "check-auth-scopes",
      label: "Check auth scopes",
      command: "check auth scopes",
    },
  ];

  const lines: string[] = [];
  lines.push(`Diagnosis: ${answer}`);

  if (connectorAnalysis?.flag) {
    lines.push(
      `Connector scope issue: policies look mis-scoped (sample target: ${connectorAnalysis.sampleTarget ?? "unknown"}).`
    );
  }

  if (planSteps.length) {
    lines.push(`What I checked:`);
    lines.push(...planSteps.map((step) => `- ${step}`));
  }

  if (hypotheses.length) {
    lines.push(`Hypotheses:`);
    lines.push(
      ...hypotheses.slice(0, 3).map((h) => {
        const pct = Math.round((h.confidence ?? 0) * 100);
        return `- ${h.cause} (${pct}% confidence)`;
      })
    );
  }

  // Override next steps to a focused set when connector policies are missing
  const focusedNextSteps = [
    "Fetch connector policies for orgunits/my_customer",
    "Validate admin scopes on current token",
    "List org units to confirm targeting",
  ];
  lines.push(`Next steps (pick one):`);
  lines.push(...focusedNextSteps.map((step) => `- ${step}`));

  if (missingQuestions.length) {
    lines.push(`Need from you:`);
    lines.push(
      ...missingQuestions.map((q) =>
        `- ${q.question}${q.why ? ` (why: ${q.why})` : ""}`
      )
    );
  }

  if (reference) {
    lines.push(`Reference: ${reference.title} - ${reference.url}`);
  }

  const finalAssistantMessage = lines.join("\n");

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
          actions,
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
          actions,
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
 * Return a structured synthetic response for eval test mode.
 */
function createTestModeResponse(): Response {
  const diagnosis = "Synthetic diagnosis for eval test mode.";
  const nextSteps = [
    "Review fixture context",
    "Compare output to expected schema",
  ];
  const hypotheses = [
    {
      cause: "Synthetic placeholder hypothesis",
      confidence: 0.2,
    },
  ];
  const planSteps = [
    "Check fixture context",
    "Generate structured response",
  ];
  const missingQuestions = [
    {
      question: "What changed most recently?",
      why: "Identify the most likely regression window",
    },
  ];
  const evidence = {
    source: "synthetic",
    planSteps,
    missingQuestions,
  };

  return new Response(
    JSON.stringify({
      diagnosis,
      nextSteps,
      hypotheses,
      planSteps,
      missingQuestions,
      evidence,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
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
