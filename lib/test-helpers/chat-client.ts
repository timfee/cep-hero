/**
 * Test client for making chat API requests with retry and timeout handling.
 */

import { expect } from "bun:test";
import { z } from "zod";

import { type FixtureData } from "@/lib/mcp/types";

const CHAT_URL = process.env.CHAT_URL ?? "http://localhost:3100/api/chat";
const USE_FAKE_CHAT = process.env.EVAL_TEST_MODE === "1";
const ALLOW_FAKE_ON_ERROR = process.env.EVAL_TEST_MODE_FALLBACK === "1";
const CHAT_TIMEOUT_MS = Number.parseInt(
  process.env.EVAL_CHAT_TIMEOUT_MS ?? "60000",
  10
);
const USE_EVAL_FIXTURE_MODE = process.env.EVAL_FIXTURES === "1";

let chatReady = false;
let chatReadyPromise: Promise<void> | undefined;

/**
 * Response from the chat API including text and optional metadata.
 */
export interface ChatResponse {
  text: string;
  metadata?: unknown;
  toolCalls?: string[];
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Options for calling the chat API with fixture data.
 */
export interface CallChatMessagesOptions {
  fixtures?: FixtureData;
}

const ChatResponseSchema = z.object({
  error: z.string().optional(),
  diagnosis: z.string().optional(),
  nextSteps: z.array(z.string()).optional(),
});

const StreamChunkSchema = z.object({
  type: z.string().optional(),
  textDelta: z.string().optional(),
  delta: z.string().optional(),
  toolName: z.string().optional(),
});

/**
 * Generate a synthetic response for test mode.
 */
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
 * Build headers for the chat API request.
 */
function buildFetchHeaders(useFixtureMode: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Test-Bypass": "1",
  };
  if (useFixtureMode) {
    headers["X-Eval-Test-Mode"] = "1";
  }
  return headers;
}

/**
 * Build the request body for the chat API.
 */
function buildFetchBody(
  messages: ChatMessage[],
  useFixtureMode: boolean,
  fixtures?: FixtureData
): Record<string, unknown> {
  const body: Record<string, unknown> = { messages };
  if (useFixtureMode && fixtures) {
    body.fixtures = fixtures;
  }
  return body;
}

/**
 * Handle error responses, returning synthetic response if allowed.
 */
function handleErrorResponse(errorMessage: string): ChatResponse {
  if (ALLOW_FAKE_ON_ERROR) {
    return syntheticResponse();
  }
  return { text: `error: ${errorMessage}` };
}

/**
 * Build response text from parsed diagnosis and next steps.
 */
function buildTextFromParsedData(
  diagnosis: string | undefined,
  nextSteps: string[]
) {
  const textLines: string[] = [];
  if (typeof diagnosis === "string" && diagnosis.length > 0) {
    textLines.push(diagnosis);
  }
  if (nextSteps.length > 0) {
    textLines.push(`Next: ${nextSteps.join("; ")}`);
  }
  return textLines.join("\n");
}

/**
 * Attempt to parse response body as JSON.
 */
function parseJsonResponse(bodyText: string): ChatResponse | null {
  const data: unknown = JSON.parse(bodyText);
  const parsed = ChatResponseSchema.safeParse(data);
  if (!parsed.success) {
    return null;
  }
  const errorMessage = parsed.data.error;
  if (typeof errorMessage === "string" && errorMessage.length > 0) {
    return handleErrorResponse(errorMessage);
  }
  const text = buildTextFromParsedData(
    parsed.data.diagnosis,
    parsed.data.nextSteps ?? []
  );
  return { text, metadata: data };
}

/**
 * Parse a single SSE stream chunk.
 */
function parseStreamChunk(
  chunk: string
): z.infer<typeof StreamChunkSchema> | null {
  try {
    const data: unknown = JSON.parse(chunk);
    const parsed = StreamChunkSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Extract and parse all SSE chunks from response body.
 */
function extractStreamChunks(
  bodyText: string
): z.infer<typeof StreamChunkSchema>[] {
  return bodyText
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.replace(/^data:\s*/, ""))
    .filter((chunk) => chunk.length > 0 && chunk !== "[done]")
    .map(parseStreamChunk)
    .filter(
      (chunk): chunk is z.infer<typeof StreamChunkSchema> => chunk !== null
    );
}

/**
 * Parse SSE streaming response into chat response.
 */
function parseStreamingResponse(bodyText: string): ChatResponse {
  const chunks = extractStreamChunks(bodyText);

  const deltas = chunks
    .filter((chunk) => chunk.type === "text-delta")
    .map((chunk) => chunk.textDelta ?? chunk.delta)
    .filter((delta): delta is string => typeof delta === "string");

  const toolCalls = chunks
    .filter(
      (chunk) => chunk.type === "tool-input-start" || chunk.type === "tool-call"
    )
    .map((chunk) => chunk.toolName)
    .filter((name): name is string => typeof name === "string");

  return {
    text: deltas.join("") || bodyText,
    toolCalls: toolCalls.length > 0 ? [...new Set(toolCalls)] : undefined,
  };
}

/**
 * Process response body, trying JSON first then falling back to streaming.
 */
function processResponseBody(bodyText: string): ChatResponse {
  if (ALLOW_FAKE_ON_ERROR && bodyText.trim().length < 10) {
    return syntheticResponse();
  }
  try {
    const jsonResponse = parseJsonResponse(bodyText);
    if (jsonResponse !== null) {
      return jsonResponse;
    }
    return parseStreamingResponse(bodyText);
  } catch {
    if (ALLOW_FAKE_ON_ERROR) {
      return syntheticResponse();
    }
    return parseStreamingResponse(bodyText);
  }
}

/**
 * Execute the chat API request with retry support.
 */
async function executeRequest(
  messages: ChatMessage[],
  options: CallChatMessagesOptions | undefined,
  controller: AbortController
) {
  const useFixtureMode =
    USE_EVAL_FIXTURE_MODE && options?.fixtures !== undefined;
  const headers = buildFetchHeaders(useFixtureMode);
  const body = buildFetchBody(messages, useFixtureMode, options?.fixtures);
  const retryOptions = ALLOW_FAKE_ON_ERROR
    ? { retries: 2, delayMs: 300, maxDelayMs: 1000 }
    : undefined;

  const result = await fetchWithRetry(async () => {
    const response = await fetch(CHAT_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return response;
  }, retryOptions);
  return result;
}

/**
 * Create a timeout that aborts the request after CHAT_TIMEOUT_MS.
 */
function createTimeoutId(
  controller: AbortController
): NodeJS.Timeout | undefined {
  if (!Number.isFinite(CHAT_TIMEOUT_MS) || CHAT_TIMEOUT_MS <= 0) {
    return undefined;
  }
  return setTimeout(() => {
    controller.abort();
  }, CHAT_TIMEOUT_MS);
}

/**
 * Execute request and process the response body.
 */
async function executeAndProcessRequest(
  messages: ChatMessage[],
  options: CallChatMessagesOptions | undefined,
  controller: AbortController
): Promise<ChatResponse> {
  const res = await executeRequest(messages, options, controller);
  expect(res.status).toBeLessThan(500);
  const bodyText = await res.text();
  return processResponseBody(bodyText);
}

/**
 * Handle chat errors, returning synthetic response if allowed.
 */
function handleChatError(error: unknown): ChatResponse {
  if (ALLOW_FAKE_ON_ERROR) {
    return syntheticResponse();
  }
  throw error;
}

/**
 * Clear timeout if it was set.
 */
function clearTimeoutIfSet(timeoutId: NodeJS.Timeout | undefined) {
  if (timeoutId !== undefined) {
    clearTimeout(timeoutId);
  }
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
  const timeoutId = createTimeoutId(controller);

  try {
    return await executeAndProcessRequest(messages, options, controller);
  } catch (error) {
    return handleChatError(error);
  } finally {
    clearTimeoutIfSet(timeoutId);
  }
}

/**
 * Call the chat endpoint with a single prompt.
 */
export function callChat(
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
 * Ensure the chat server is ready before making requests.
 */
async function ensureChatReady(url: string) {
  if (chatReady || !url.includes("localhost")) {
    return;
  }

  chatReadyPromise ??= (async () => {
    try {
      chatReady = await waitForChatReady(url, 8, 250);
    } finally {
      chatReadyPromise = undefined;
    }
  })();

  if (chatReadyPromise !== undefined) {
    await chatReadyPromise;
  }
}

/**
 * Poll the server until it responds or max attempts reached.
 */
async function waitForChatReady(
  url: string,
  attempts: number,
  delayMs: number
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await isServerUp(url)) {
      return true;
    }
    await Bun.sleep(delayMs);
  }
  return false;
}

/**
 * Check if the server is responding.
 */
async function isServerUp(url: string) {
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

/**
 * Determine if we should return the response or retry.
 */
function shouldReturnResponse(
  status: number,
  attempt: number,
  maxRetries: number
) {
  return !isRetryableStatus(status) || attempt >= maxRetries;
}

/**
 * Wait with exponential backoff and jitter before retrying.
 */
async function waitBeforeRetry(delay: number, maxDelayMs: number) {
  const jitterMs = Math.floor(Math.random() * 200);
  await Bun.sleep(delay + jitterMs);
  return Math.min(maxDelayMs, Math.ceil(delay * 1.8));
}

interface RetryState {
  attempt: number;
  delay: number;
}

/**
 * Attempt a single fetch, returning response or null to retry.
 */
async function attemptFetch(
  action: () => Promise<Response>,
  state: RetryState,
  maxRetries: number
): Promise<Response | null> {
  try {
    const response = await action();
    if (shouldReturnResponse(response.status, state.attempt, maxRetries)) {
      return response;
    }
    return null;
  } catch (error) {
    if (state.attempt >= maxRetries) {
      throw error;
    }
    return null;
  }
}

/**
 * Fetch with automatic retries on transient failures.
 */
async function fetchWithRetry(
  action: () => Promise<Response>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS
): Promise<Response> {
  const state: RetryState = { attempt: 0, delay: options.delayMs };

  while (true) {
    const response = await attemptFetch(action, state, options.retries);
    if (response) {
      return response;
    }
    state.delay = await waitBeforeRetry(state.delay, options.maxDelayMs);
    state.attempt += 1;
  }
}

/**
 * Check if HTTP status code indicates a transient error worth retrying.
 */
function isRetryableStatus(status: number) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}
