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

/**
 * Handle streaming CEP chat responses.
 */
export async function POST(req: Request) {
  // 1. Authenticate
  const authResult = await authenticateRequest(req);

  if (authResult.status === "unauthorized") {
    return Response.json({ error: authResult.error }, { status: 401 });
  }

  if (authResult.status === "test_mode_response") {
    return Response.json(
      {
        error:
          "Test mode response not supported. Use fixture injection instead.",
      },
      { status: 400 }
    );
  }

  const { accessToken } = authResult;

  // 2. Parse Request Body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const messagesFromBody = getMessagesFromBody(body);
  const inlinePrompt = extractInlinePrompt(body);

  let messages: ChatMessage[] = [];
  if (messagesFromBody.length > 0) {
    messages = messagesFromBody;
  } else if (inlinePrompt) {
    messages = [{ role: "user", content: inlinePrompt }];
  }

  if (messages.length === 0) {
    console.warn("POST /api/chat: Empty messages received.", {
      body: isRecord(body) ? body : safeJsonPreview(body),
    });
    return new Response("I didn't receive a message. Please try again.", {
      status: 200,
    });
  }

  // 3. Check for fixture data in eval mode
  const isEvalTestMode = req.headers.get("x-eval-test-mode") === "1";
  const fixtureData = extractFixtureData(body);
  const executor =
    isEvalTestMode && fixtureData
      ? new FixtureToolExecutor(loadFixtureData(fixtureData))
      : undefined;

  // 5. Create and Return Chat Stream
  return createChatStream({
    messages,
    accessToken,
    executor,
  });
}
