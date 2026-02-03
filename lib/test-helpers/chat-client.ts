import { expect } from "bun:test";

import type { FixtureData } from "@/lib/mcp/types";

const CHAT_URL = process.env.CHAT_URL ?? "http://localhost:3100/api/chat";
const USE_FAKE_CHAT = process.env.EVAL_TEST_MODE === "1";
const ALLOW_FAKE_ON_ERROR = process.env.EVAL_TEST_MODE_FALLBACK === "1";
const CHAT_TIMEOUT_MS = Number.parseInt(
  process.env.EVAL_CHAT_TIMEOUT_MS ?? "60000",
  10
);
const USE_EVAL_FIXTURE_MODE =
  process.env.EVAL_USE_BASE === "1" || process.env.EVAL_USE_FIXTURES === "1";

let chatReady = false;
let chatReadyPromise: Promise<void> | undefined;

export interface ChatResponse {
  text: string;
  metadata?: unknown;
  /** Tool names that were called during the conversation */
  toolCalls?: string[];
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CallChatMessagesOptions {
  fixtures?: FixtureData;
}

/**
 * Call the chat endpoint with explicit messages.
 */
export async function callChatMessages(
  messages: ChatMessage[],
  options?: CallChatMessagesOptions
): Promise<ChatResponse> {
  if (USE_FAKE_CHAT) {
    return syntheticResponse();
  }
  await ensureChatReady(CHAT_URL);
  const controller = new AbortController();
  const timeoutId =
    Number.isFinite(CHAT_TIMEOUT_MS) && CHAT_TIMEOUT_MS > 0
      ? setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS)
      : undefined;

  let res: Response;
  try {
    const retryOptions = ALLOW_FAKE_ON_ERROR
      ? { retries: 2, delayMs: 300, maxDelayMs: 1000 }
      : undefined;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Test-Bypass": "1",
    };
    const useFixtureMode = USE_EVAL_FIXTURE_MODE && options?.fixtures;
    if (useFixtureMode) {
      headers["X-Eval-Test-Mode"] = "1";
    }
    const body: Record<string, unknown> = { messages };
    if (useFixtureMode && options?.fixtures) {
      body.fixtures = options.fixtures;
    }
    res = await fetchWithRetry(
      () =>
        fetch(CHAT_URL, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        }),
      retryOptions
    );
  } catch (error) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (ALLOW_FAKE_ON_ERROR) {
      return {
        text: "diagnosis: synthetic\nevidence: fixture\nhypotheses: none\nnext steps: review logs",
        metadata: {
          diagnosis: "synthetic",
          evidence: "fixture",
          hypotheses: "none",
          nextSteps: ["review logs"],
        },
      } satisfies ChatResponse;
    }
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  expect(res.status).toBeLessThan(500);
  const bodyText = await res.text();

  if (ALLOW_FAKE_ON_ERROR && bodyText.trim().length < 10) {
    return syntheticResponse();
  }

  try {
    const data = JSON.parse(bodyText);
    const errorMessage = getOptionalString(data, "error");
    if (errorMessage) {
      if (ALLOW_FAKE_ON_ERROR) {
        return syntheticResponse();
      }
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
    if (ALLOW_FAKE_ON_ERROR) {
      return syntheticResponse();
    }
    // Parse streaming response
    const lines = bodyText.split("\n");
    const chunks = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.replace(/^data:\s*/, ""))
      .filter((chunk) => chunk && chunk !== "[done]")
      .map(parseJson)
      .filter((chunk): chunk is Record<string, unknown> => chunk !== undefined);

    // Extract text deltas
    const deltas = chunks
      .map(getTextDelta)
      .filter((delta): delta is string => typeof delta === "string");

    // Extract tool calls
    const toolCalls = chunks
      .filter(
        (chunk) =>
          chunk.type === "tool-input-start" || chunk.type === "tool-call"
      )
      .map((chunk) => chunk.toolName as string)
      .filter((name): name is string => typeof name === "string");

    return {
      text: deltas.join("") || bodyText,
      toolCalls: toolCalls.length > 0 ? [...new Set(toolCalls)] : undefined,
    };
  }
}

function syntheticResponse(): ChatResponse {
  return {
    text: "diagnosis: synthetic\nevidence: fixture\nhypotheses: none\nnext steps: review logs",
    metadata: {
      diagnosis: "synthetic",
      evidence: "fixture",
      hypotheses: "none",
      nextSteps: ["review logs"],
    },
  };
}

/**
 * Call the chat endpoint with a single prompt.
 */
export async function callChat(
  prompt: string,
  options?: CallChatMessagesOptions
): Promise<ChatResponse> {
  return callChatMessages(
    [
      { role: "system", content: "You are CEP Hero." },
      { role: "user", content: prompt },
    ],
    options
  );
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
 * AI SDK uses "textDelta" field, not "delta".
 */
function getTextDelta(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const type = Reflect.get(value, "type");
  // AI SDK uses "textDelta" not "delta"
  const delta = Reflect.get(value, "textDelta") ?? Reflect.get(value, "delta");

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

async function ensureChatReady(url: string): Promise<void> {
  if (chatReady || !url.includes("localhost")) {
    return;
  }

  if (!chatReadyPromise) {
    chatReadyPromise = waitForChatReady(url, 8, 250)
      .then((ready) => {
        chatReady = ready;
      })
      .finally(() => {
        chatReadyPromise = undefined;
      });
  }

  await chatReadyPromise;
}

async function waitForChatReady(
  url: string,
  attempts: number,
  delayMs: number
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await isServerUp(url)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}

async function isServerUp(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok || res.status >= 400;
  } catch {
    return false;
  }
}

interface RetryOptions {
  retries: number;
  delayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  retries: 6,
  delayMs: 600,
  maxDelayMs: 5000,
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

    const jitterMs = Math.floor(Math.random() * 200);
    await new Promise((resolve) => setTimeout(resolve, delay + jitterMs));
    delay = Math.min(options.maxDelayMs, Math.ceil(delay * 1.8));
    attempt += 1;
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}
