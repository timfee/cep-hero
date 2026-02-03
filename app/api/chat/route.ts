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

interface AuthenticatedRequest {
  accessToken: string;
  body: unknown;
  messages: ChatMessage[];
}

async function authenticateChat(req: Request): Promise<Response | string> {
  const authResult = await authenticateRequest(req);
  const authError = handleAuthError(
    authResult.status,
    authResult.status === "unauthorized" ? authResult.error : undefined
  );
  if (authError) {
    return authError;
  }
  const { accessToken } = authResult as { accessToken: string };
  return accessToken;
}

function parseBodyAndMessages(
  body: unknown
): Response | { body: unknown; messages: ChatMessage[] } {
  const messages = extractMessages(body);
  if (messages.length === 0) {
    return handleEmptyMessages(body);
  }
  return { body, messages };
}

async function validateAndParseRequest(
  req: Request
): Promise<Response | AuthenticatedRequest> {
  const authResult = await authenticateChat(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const body = await parseRequestBody(req);
  if (body instanceof Response) {
    return body;
  }

  const parsed = parseBodyAndMessages(body);
  if (parsed instanceof Response) {
    return parsed;
  }

  return { accessToken: authResult, ...parsed };
}

/**
 * Handle streaming CEP chat responses.
 */
export async function POST(req: Request) {
  const result = await validateAndParseRequest(req);
  if (result instanceof Response) {
    return result;
  }

  const { accessToken, body, messages } = result;
  return createChatStream({
    messages,
    accessToken,
    executor: createExecutor(req, body),
  });
}
