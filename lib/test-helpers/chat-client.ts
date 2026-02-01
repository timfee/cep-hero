import { expect } from "bun:test";

const CHAT_URL = process.env.CHAT_URL ?? "http://localhost:3100/api/chat";

export type ChatResponse = {
  text: string;
  metadata?: unknown;
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * Call the chat endpoint with explicit messages.
 */
export async function callChatMessages(
  messages: ChatMessage[]
): Promise<ChatResponse> {
  const res = await fetchWithRetry(() =>
    fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Test-Bypass": "1",
      },
      body: JSON.stringify({ messages }),
    })
  );

  expect(res.status).toBeLessThan(500);
  const bodyText = await res.text();

  try {
    const data = JSON.parse(bodyText);
    const errorMessage = getOptionalString(data, "error");
    if (errorMessage) {
      return { text: `error: ${errorMessage}` };
    }
    const textLines: string[] = [];
    const diagnosis = getOptionalString(data, "diagnosis");
    if (diagnosis) {
      textLines.push(diagnosis);
    }
    const nextSteps = getStringArray(data, "nextSteps");
    if (nextSteps.length > 0) {
      textLines.push(`Next: ${nextSteps.join("; ")}`);
    }
    return { text: textLines.join("\n"), metadata: data };
  } catch {
    const lines = bodyText.split("\n");
    const deltas = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.replace(/^data:\s*/, ""))
      .filter((chunk) => chunk && chunk !== "[done]")
      .map(parseJson)
      .map(getTextDelta)
      .filter((delta): delta is string => typeof delta === "string");
    return { text: deltas.join("") || bodyText };
  }
}

/**
 * Call the chat endpoint with a single prompt.
 */
export async function callChat(prompt: string): Promise<ChatResponse> {
  return callChatMessages([
    { role: "system", content: "You are the CEP troubleshooting assistant." },
    { role: "user", content: prompt },
  ]);
}

/**
 * Parse JSON safely, returning undefined on failure.
 */
function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/**
 * Extract text delta payload from a streaming chunk.
 */
function getTextDelta(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const type = Reflect.get(value, "type");
  const delta = Reflect.get(value, "delta");

  if (type !== "text-delta") {
    return undefined;
  }

  return typeof delta === "string" ? delta : undefined;
}

/**
 * Extract a string property from unknown objects.
 */
function getOptionalString(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const property = Reflect.get(value, key);
  return typeof property === "string" ? property : undefined;
}

/**
 * Extract a string array from unknown objects.
 */
function getStringArray(value: unknown, key: string): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const property = Reflect.get(value, key);
  return Array.isArray(property) &&
    property.every((item) => typeof item === "string")
    ? property
    : [];
}

type RetryOptions = {
  retries: number;
  delayMs: number;
  maxDelayMs: number;
};

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  retries: 3,
  delayMs: 400,
  maxDelayMs: 2000,
};

async function fetchWithRetry(
  action: () => Promise<Response>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS
): Promise<Response> {
  let attempt = 0;
  let delay = options.delayMs;

  while (true) {
    try {
      const response = await action();
      if (!isRetryableStatus(response.status) || attempt >= options.retries) {
        return response;
      }
    } catch (error) {
      if (attempt >= options.retries) {
        throw error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(options.maxDelayMs, delay * 2);
    attempt += 1;
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}
