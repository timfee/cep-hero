import { google } from "@ai-sdk/google";
import { streamText, tool } from "ai";
import { z } from "zod";

import { diagnose } from "@/app/api/chat/diagnose";
import { auth } from "@/lib/auth";
import { CepToolExecutor, GetChromeEventsSchema } from "@/lib/mcp/registry";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * Stream CEP diagnosis, delegating evidence gathering to the diagnose helper.
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return new Response(
      JSON.stringify({ error: "Unauthorized. Please sign in." }),
      { status: 401 }
    );
  }

  const accessTokenResponse = await auth.api.getAccessToken({
    body: { providerId: "google" },
    headers: req.headers,
  });

  if (!accessTokenResponse?.accessToken) {
    return new Response(
      JSON.stringify({ error: "Missing Google access token." }),
      { status: 401 }
    );
  }

  const body = await req.json();
  const messages = getMessagesFromBody(body);
  const prompt = getLastUserMessage(messages);

  const executor = new CepToolExecutor(accessTokenResponse.accessToken);

  const result = streamText({
    model: google("gemini-2.0-flash-001"),
    messages: [
      {
        role: "system",
        content:
          "You are the CEP troubleshooting assistant. Answer first, then offer actions. Use tools only when needed. Do not dump raw output.",
      },
      { role: "user", content: prompt },
    ],
    tools: {
      getChromeEvents: tool({
        description: "Get recent Chrome events.",
        inputSchema: GetChromeEventsSchema,
        execute: async (args: z.infer<typeof GetChromeEventsSchema>) =>
          await executor.getChromeEvents(args),
      }),
      runDiagnosis: tool({
        description: "Run full diagnosis and return structured answer.",
        inputSchema: z.object({ prompt: z.string() }),
        execute: async (args) => await diagnose(req, args.prompt),
      }),
    },
    toolChoice: {
      type: "tool",
      toolName: "runDiagnosis",
    },
  });

  return result.toTextStreamResponse();
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
