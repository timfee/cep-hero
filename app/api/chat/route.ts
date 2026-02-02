import type { FixtureData } from "@/lib/mcp/types";

import { authenticateRequest } from "@/lib/chat/auth-service";
import { createChatStream } from "@/lib/chat/chat-service";
import {
  extractInlinePrompt,
  getMessagesFromBody,
  getLastUserMessage,
  safeJsonPreview,
  ChatMessage,
} from "@/lib/chat/request-utils";
import { writeDebugLog } from "@/lib/debug-log";
import {
  FixtureToolExecutor,
  loadFixtureData,
} from "@/lib/mcp/fixture-executor";

export const maxDuration = 30;

function extractFixtureData(body: unknown): FixtureData | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const fixtures = Reflect.get(body, "fixtures");
  if (!fixtures || typeof fixtures !== "object") {
    return null;
  }
  return fixtures as FixtureData;
}

/**
 * Handle streaming CEP chat responses.
 */
export async function POST(req: Request) {
  // 1. Authenticate
  const authResult = await authenticateRequest(req);

  if (authResult.status === "unauthorized") {
    return new Response(JSON.stringify({ error: authResult.error }), {
      status: 401,
    });
  }

  if (authResult.status === "test_mode_response") {
    return new Response(
      JSON.stringify({
        error:
          "Test mode response not supported. Use fixture injection instead.",
      }),
      {
        status: 400,
      }
    );
  }

  const { session, accessToken, isTestMode } = authResult;

  // 2. Parse Request Body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
    });
  }

  const messagesFromBody = getMessagesFromBody(body);
  const inlinePrompt = extractInlinePrompt(body);
  const prompt = getLastUserMessage(messagesFromBody) || inlinePrompt;

  const messages: ChatMessage[] = messagesFromBody.length
    ? messagesFromBody
    : inlinePrompt
      ? [{ role: "user", content: inlinePrompt }]
      : [];

  if (messages.length === 0) {
    console.warn("POST /api/chat: Empty messages received.", {
      body: typeof body === "object" ? body : safeJsonPreview(body),
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

  // 4. Log Request
  await writeDebugLog("chat.request", {
    prompt,
    user: session.user?.id,
    evalTestMode: isTestMode,
    fixtureMode: !!executor,
    messageCount: messages.length,
    lastMessageRole: messages.at(-1)?.role,
    lastMessageLen: messages.at(-1)?.content?.length ?? 0,
    bodyPreview: safeJsonPreview(body),
  });

  // 5. Create and Return Chat Stream
  return createChatStream({
    messages,
    accessToken,
    executor,
  });
}
