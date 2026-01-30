import { google } from "@ai-sdk/google";
import { streamText, tool } from "ai";
import { z } from "zod";

import { diagnose } from "@/app/api/chat/diagnose";
import { auth } from "@/lib/auth";
import { CepToolExecutor, GetChromeEventsSchema } from "@/lib/mcp/registry";

/**
 * Streamed diagnosis: calls our diagnose helper (which fetches evidence) and then streams
 * a synthesized answer. This keeps the UI answer-first.
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

  const { messages } = await req.json();
  const lastUser = [...messages].reverse().find((m: any) => m.role === "user");
  const prompt = lastUser?.content || "";

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
      // Example: allow streaming events, but the main diagnosis is from diagnose()
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
