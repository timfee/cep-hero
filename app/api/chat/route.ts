import { google } from "@ai-sdk/google";
import { streamText, tool } from "ai";
import { z } from "zod";

import { diagnose } from "@/app/api/chat/diagnose";
import { auth } from "@/lib/auth";
import { writeDebugLog } from "@/lib/debug-log";
import {
  CepToolExecutor,
  EnrollBrowserSchema,
  GetChromeEventsSchema,
  GetConnectorConfigSchema,
  GetFleetOverviewSchema,
  ListDLPRulesSchema,
} from "@/lib/mcp/registry";

export const maxDuration = 30;
const EVAL_TEST_MODE_ENABLED = process.env.EVAL_TEST_MODE === "1";

const debugAuthSchema = z.object({});

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const systemPrompt =
  "You are the CEP troubleshooting assistant. Answer concisely, then offer actions. Use tools only when needed and summarize results instead of dumping raw output. If connector policies are missing or empty, suggest checking org unit targeting and admin scopes. Do not bypass the model or return synthetic responses outside EVAL_TEST_MODE.";

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
    } catch {
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
  const messagesFromBody = getMessagesFromBody(body);
  const inlinePrompt = extractInlinePrompt(body);
  const prompt = getLastUserMessage(messagesFromBody) || inlinePrompt;

  const messages: ChatMessage[] = messagesFromBody.length
    ? messagesFromBody
    : inlinePrompt
      ? [{ role: "user", content: inlinePrompt }]
      : [];

  if (messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "Message content is required." }),
      { status: 400 }
    );
  }

  await writeDebugLog("chat.request", {
    prompt,
    user: session.user?.id,
    evalTestMode: isEvalTestMode,
    messageCount: messages.length,
    lastMessageRole: messages.at(-1)?.role,
    lastMessageLen: messages.at(-1)?.content?.length ?? 0,
    bodyPreview: safeJsonPreview(body),
  });

  const executor = new CepToolExecutor(accessTokenResponse.accessToken);

  // Track structured data from diagnosis tool for message metadata
  let diagnosisResult: Awaited<ReturnType<typeof diagnose>> | null = null;

  const result = streamText({
    model: google("gemini-2.0-flash-001"),
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    tools: {
      getChromeEvents: tool({
        description: "Get recent Chrome events.",
        inputSchema: GetChromeEventsSchema,
        execute: async (args) => await executor.getChromeEvents(args),
      }),
      getChromeConnectorConfiguration: tool({
        description: "Fetch Chrome connector configuration policies.",
        inputSchema: GetConnectorConfigSchema,
        execute: async () => await executor.getChromeConnectorConfiguration(),
      }),
      listDLPRules: tool({
        description: "List DLP rules from Cloud Identity.",
        inputSchema: ListDLPRulesSchema,
        execute: async (args) => await executor.listDLPRules(args),
      }),
      enrollBrowser: tool({
        description: "Generate a Chrome Browser Cloud Management enrollment token.",
        inputSchema: EnrollBrowserSchema,
        execute: async (args) => await executor.enrollBrowser(args),
      }),
      getFleetOverview: tool({
        description: "Summarize fleet posture from live CEP data.",
        inputSchema: GetFleetOverviewSchema,
        execute: async (args) => await executor.getFleetOverview(args),
      }),
      debugAuth: tool({
        description: "Inspect access token scopes and expiry.",
        inputSchema: debugAuthSchema,
        execute: async () => await executor.debugAuth(),
      }),
      runDiagnosis: tool({
        description: "Run full diagnosis and return structured answer.",
        inputSchema: z.object({ prompt: z.string() }),
        execute: async (args) => {
          const result = await diagnose(req, args.prompt);
          diagnosisResult = result;
          return result;
        },
      }),
    },
  });

  // Return stream response
  return result.toUIMessageStreamResponse({
    sendReasoning: true,
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
  const rawParts = Reflect.get(value, "parts") as unknown;

  if (role !== "system" && role !== "user" && role !== "assistant") {
    return null;
  }

  const content = stringifyContent(rawContent ?? rawParts);
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
        const reasoning = Reflect.get(part, "reasoning");
        if (type === "reasoning" && typeof reasoning === "string") {
          return reasoning;
        }
        return "";
      })
      .filter(Boolean);
    return textParts.join("\n").trim();
  }
  return "";
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
