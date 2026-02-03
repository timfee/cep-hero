import { authenticateRequest } from "@/lib/chat/auth-service";
import { createChatStream } from "@/lib/chat/chat-service";
import {
  type ChatMessage,
  extractInlinePrompt,
  getMessagesFromBody,
  safeJsonPreview,
} from "@/lib/chat/request-utils";
import {
  FixtureToolExecutor,
  loadFixtureData,
} from "@/lib/mcp/fixture-executor";

export const maxDuration = 30;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractFixtureData(body: unknown) {
  if (!isRecord(body)) {
    return null;
  }
  const fixtures = Reflect.get(body, "fixtures");
  if (!isRecord(fixtures)) {
    return null;
  }
  return fixtures;
}

function handleAuthError(status: string, error?: string): Response | null {
  if (status === "unauthorized") {
    return Response.json({ error }, { status: 401 });
  }
  if (status === "test_mode_response") {
    return Response.json(
      {
        error:
          "Test mode response not supported. Use fixture injection instead.",
      },
      { status: 400 }
    );
  }
  return null;
}

async function parseRequestBody(req: Request): Promise<unknown | Response> {
  try {
    return await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
}

function extractMessages(body: unknown): ChatMessage[] {
  const messagesFromBody = getMessagesFromBody(body);
  if (messagesFromBody.length > 0) {
    return messagesFromBody;
  }
  const inlinePrompt = extractInlinePrompt(body);
  return inlinePrompt ? [{ role: "user", content: inlinePrompt }] : [];
}

function handleEmptyMessages(body: unknown): Response {
  console.warn("POST /api/chat: Empty messages received.", {
    body: isRecord(body) ? body : safeJsonPreview(body),
  });
  return new Response("I didn't receive a message. Please try again.", {
    status: 200,
  });
}

function createExecutor(req: Request, body: unknown) {
  const isEvalTestMode = req.headers.get("x-eval-test-mode") === "1";
  const fixtureData = extractFixtureData(body);
  return isEvalTestMode && fixtureData
    ? new FixtureToolExecutor(loadFixtureData(fixtureData))
    : undefined;
}

/**
 * Handle streaming CEP chat responses.
 */
export async function POST(req: Request) {
  const authResult = await authenticateRequest(req);
  const authError = handleAuthError(
    authResult.status,
    authResult.status === "unauthorized" ? authResult.error : undefined
  );
  if (authError) {
    return authError;
  }

  const body = await parseRequestBody(req);
  if (body instanceof Response) {
    return body;
  }

  const messages = extractMessages(body);
  if (messages.length === 0) {
    return handleEmptyMessages(body);
  }

  const { accessToken } = authResult as { accessToken: string };
  return createChatStream({
    messages,
    accessToken,
    executor: createExecutor(req, body),
  });
}
