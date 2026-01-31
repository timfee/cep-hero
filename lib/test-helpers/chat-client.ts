import { expect } from "bun:test";

const CHAT_URL = process.env.CHAT_URL ?? "http://localhost:3100/api/chat";

export type ChatResponse = {
  text: string;
  metadata?: any;
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function callChatMessages(
  messages: ChatMessage[]
): Promise<ChatResponse> {
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Test-Bypass": "1",
    },
    body: JSON.stringify({ messages }),
  });

  expect(res.status).toBeLessThan(500);
  const bodyText = await res.text();

  // Streaming responses are plain text, not JSON.
  try {
    const data = JSON.parse(bodyText);
    if (data.error) {
      return { text: `error: ${data.error}` };
    }
    const diagnosis = data as any;
    const textLines: string[] = [];
    if (diagnosis.diagnosis) textLines.push(diagnosis.diagnosis);
    if (diagnosis.nextSteps?.length) {
      textLines.push(`Next: ${diagnosis.nextSteps.join("; ")}`);
    }
    return { text: textLines.join("\n"), metadata: diagnosis };
  } catch {
    const lines = bodyText.split("\n");
    const deltas = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.replace(/^data:\s*/, ""))
      .filter((chunk) => chunk && chunk !== "[done]")
      .map((chunk) => {
        try {
          return JSON.parse(chunk);
        } catch {
          return null;
        }
      })
      .filter((chunk) => chunk && chunk.type === "text-delta")
      .map((chunk) => chunk.delta as string);
    return { text: deltas.join("") || bodyText };
  }
}

export async function callChat(prompt: string): Promise<ChatResponse> {
  return callChatMessages([
    { role: "system", content: "You are the CEP troubleshooting assistant." },
    { role: "user", content: prompt },
  ]);
}
