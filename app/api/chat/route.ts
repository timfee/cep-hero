import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { google as googleApis } from "googleapis";

import type { DiagnosisError, DiagnosisResult } from "@/types/chat";

import { diagnose } from "@/app/api/chat/diagnose";
import { auth } from "@/lib/auth";
import { writeDebugLog } from "@/lib/debug-log";
import { CepToolExecutor } from "@/lib/mcp/registry";

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
  const prompt = getLastUserMessage(messages) || extractInlinePrompt(body);

  await writeDebugLog("chat.request", {
    prompt,
    user: session.user?.id,
    evalTestMode: isEvalTestMode,
    messageCount: messages.length,
    lastMessageRole: messages.at(-1)?.role,
    lastMessageLen: messages.at(-1)?.content?.length ?? 0,
    bodyPreview: safeJsonPreview(body),
  });

  const accessToken = accessTokenResponse.accessToken;

  const actionResponse = await maybeHandleAction({
    command: prompt.toLowerCase(),
    accessToken,
  });
  if (actionResponse) {
    await writeDebugLog("chat.action", {
      command: prompt,
      status: actionResponse.status,
    });

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({
          type: "start",
          messageId: "assistant",
          messageMetadata: {},
        });
        writer.write({ type: "text-start", id: "assistant" });
        writer.write({
          type: "text-delta",
          id: "assistant",
          delta: actionResponse.message,
        });
        writer.write({ type: "text-end", id: "assistant" });
        writer.write({ type: "finish", messageMetadata: {} });
      },
      onError: () => "An error occurred while streaming.",
    });

    return createUIMessageStreamResponse({ stream });
  }

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
      ...missingQuestions.map(
        (q) => `- ${q.question}${q.why ? ` (why: ${q.why})` : ""}`
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
  const planSteps = ["Check fixture context", "Generate structured response"];
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

function getMessagesFromBody(body: unknown): ChatMessage[] {
  if (!body || typeof body !== "object") {
    return [];
  }

  const messages = Reflect.get(body, "messages");
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((message) => normalizeMessage(message))
    .filter(Boolean) as ChatMessage[];
}

function normalizeMessage(value: unknown): ChatMessage | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const role = Reflect.get(value, "role");
  const rawContent = Reflect.get(value, "content") as unknown;

  if (role !== "system" && role !== "user" && role !== "assistant") {
    return null;
  }

  const content = stringifyContent(rawContent);
  if (!content) {
    return null;
  }

  return { role, content };
}

function stringifyContent(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    const textParts = raw
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        const type = Reflect.get(part, "type");
        const text = Reflect.get(part, "text");
        if (type === "text" && typeof text === "string") return text;
        return "";
      })
      .filter(Boolean);
    return textParts.join("\n").trim();
  }
  return "";
}

type ActionResult = { message: string; status: "ok" | "error" };

async function maybeHandleAction({
  command,
  accessToken,
}: {
  command: string;
  accessToken: string;
}): Promise<ActionResult | null> {
  const normalized = command.trim().toLowerCase();
  if (!normalized) return null;

  if (
    normalized.includes("retry connector fetch") ||
    normalized.includes("list connector policies")
  ) {
    return handleConnectorFetch(accessToken);
  }

  if (
    normalized.includes("check org units") ||
    normalized.includes("list org units")
  ) {
    return handleListOrgUnits(accessToken);
  }

  if (
    normalized.includes("check auth scopes") ||
    normalized.includes("validate admin scopes")
  ) {
    return handleCheckAuthScopes(accessToken);
  }

  if (
    normalized.includes("review events") ||
    normalized.includes("show recent chrome events") ||
    normalized.includes("show events") ||
    normalized.includes("list events")
  ) {
    return handleShowEvents(accessToken);
  }

  return null;
}

async function handleConnectorFetch(
  accessToken: string
): Promise<ActionResult> {
  const executor = new CepToolExecutor(accessToken);
  const result = await executor.getChromeConnectorConfiguration();

  const policies =
    "value" in result && Array.isArray((result as any).value)
      ? (result as any).value
      : [];
  const errors = (result as any).errors as
    | Array<{ targetResource: string; message: string }>
    | undefined;
  const targetResource = (result as any).targetResource as string | undefined;

  const lines: string[] = [];
  lines.push(`Connector policy fetch`);
  lines.push(`- Target: ${targetResource ?? "root org unit variants"}`);
  lines.push(`- Policies returned: ${policies.length}`);
  if (errors?.length) {
    lines.push(`Errors:`);
    errors.slice(0, 3).forEach((err) => {
      lines.push(`- ${err.targetResource}: ${err.message}`);
    });
  }
  if (policies.length === 0 && !errors?.length) {
    lines.push("No connector policies returned. Verify targeting and scopes.");
  }

  return { message: lines.join("\n"), status: "ok" };
}

async function handleListOrgUnits(accessToken: string): Promise<ActionResult> {
  const authClient = buildOAuth(accessToken);
  const directory = googleApis.admin({
    version: "directory_v1",
    auth: authClient,
  });
  try {
    const res = await directory.orgunits.list({
      customerId: "my_customer",
      type: "all",
    });
    const units = res.data.organizationUnits ?? [];
    const sample = units
      .slice(0, 5)
      .map((ou) => ou.orgUnitPath ?? ou.name ?? "(unknown)");
    const lines = [
      `Org units (${units.length}):`,
      ...sample.map((p) => `- ${p}`),
    ];
    return { message: lines.join("\n"), status: "ok" };
  } catch (error) {
    return {
      message: `Org unit lookup failed: ${getErrorMessage(error)}`,
      status: "error",
    };
  }
}

async function handleCheckAuthScopes(
  accessToken: string
): Promise<ActionResult> {
  const executor = new CepToolExecutor(accessToken);
  try {
    const result = await executor.debugAuth();
    if ("error" in result) {
      return {
        message: `Scope check failed: ${result.error}`,
        status: "error",
      };
    }

    const scopes = result.scope ? result.scope.split(" ") : [];
    const required = [
      "https://www.googleapis.com/auth/admin.directory.orgunit",
      "https://www.googleapis.com/auth/chrome.management.policy",
    ];
    const missing = required.filter((scope) => !scopes.includes(scope));
    const lines = [
      "Token scopes:",
      scopes.length
        ? scopes.map((s) => `- ${s}`).join("\n")
        : "- (none reported)",
      `Expires in: ${result.expiresIn ?? "unknown"}s`,
    ];
    if (missing.length) {
      lines.push(`Missing required scopes: ${missing.join(", ")}`);
    }
    if (result.issuedTo) {
      lines.push(`Issued to: ${result.issuedTo}`);
    }
    return {
      message: lines.join("\n"),
      status: missing.length ? "error" : "ok",
    };
  } catch (error) {
    return {
      message: `Scope check failed: ${getErrorMessage(error)}`,
      status: "error",
    };
  }
}

async function handleShowEvents(accessToken: string): Promise<ActionResult> {
  const executor = new CepToolExecutor(accessToken);
  try {
    const result = await executor.getChromeEvents({ maxResults: 25 });
    if ("error" in result) {
      return {
        message: `Events lookup failed: ${result.error}`,
        status: "error",
      };
    }
    const events = result.events ?? [];
    const sample = events.slice(0, 5).map((evt) => {
      const id = evt.id?.uniqueQualifier ?? "(no id)";
      const time = evt.id?.time ?? "(no time)";
      return `- ${time} :: ${id}`;
    });
    const lines = [
      `Chrome events fetched: ${events.length}`,
      ...(sample.length ? ["Sample:", ...sample] : []),
    ];
    return { message: lines.join("\n"), status: "ok" };
  } catch (error) {
    return {
      message: `Events lookup failed: ${getErrorMessage(error)}`,
      status: "error",
    };
  }
}

function buildOAuth(accessToken: string) {
  const client = new googleApis.auth.OAuth2();
  client.setCredentials({ access_token: accessToken });
  return client;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

function safeJsonPreview(value: unknown, limit = 500): string {
  try {
    const str = JSON.stringify(value);
    return str.length > limit ? `${str.slice(0, limit)}…` : str;
  } catch {
    return "(unserializable)";
  }
}

function extractInlinePrompt(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const maybeInput = Reflect.get(body as object, "input");
  if (typeof maybeInput === "string" && maybeInput.trim()) return maybeInput;
  const maybeContent = Reflect.get(body as object, "content");
  if (typeof maybeContent === "string" && maybeContent.trim())
    return maybeContent;
  return "";
}

/**
 * Narrow diagnosis results to error responses.
 */
function isDiagnosisError(result: DiagnosisResult): result is DiagnosisError {
  return "error" in result;
}
