import {
  authenticateRequest,
  createTestModeResponse,
} from "@/lib/chat/auth-service";
import { createChatStream } from "@/lib/chat/chat-service";
import {
  extractInlinePrompt,
  getMessagesFromBody,
  getLastUserMessage,
  safeJsonPreview,
  ChatMessage,
} from "@/lib/chat/request-utils";
import { writeDebugLog } from "@/lib/debug-log";

export const maxDuration = 30;

/**
 * Handle streaming CEP diagnosis chat responses.
 */
export async function POST(req: Request) {
  // 1. Authenticate and handle Test Mode logic
  const authResult = await authenticateRequest(req);

  if (authResult.status === "test_mode_response") {
    return createTestModeResponse();
  }

  if (authResult.status === "unauthorized") {
    return new Response(JSON.stringify({ error: authResult.error }), {
      status: 401,
    });
  }

  const { session, accessToken, isTestMode } = authResult;

  // 2. Parse Request Body
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

  // 3. Log Request
  await writeDebugLog("chat.request", {
    prompt,
    user: session.user?.id,
    evalTestMode: isTestMode,
    messageCount: messages.length,
    lastMessageRole: messages.at(-1)?.role,
    lastMessageLen: messages.at(-1)?.content?.length ?? 0,
    bodyPreview: safeJsonPreview(body),
  });

  // 4. Create and Return Chat Stream
  return createChatStream({
    messages,
    accessToken,
    req,
  });
}
