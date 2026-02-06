/**
 * Unit tests for chat request body parsing and normalization utilities.
 */

import { describe, expect, it } from "bun:test";

import type { ChatMessage } from "./request-utils";

import {
  extractInlinePrompt,
  getLastUserMessage,
  getMessagesFromBody,
  safeJsonPreview,
} from "./request-utils";

describe("getMessagesFromBody", () => {
  it("extracts standard messages array correctly", () => {
    const body = {
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ],
    };

    const result = getMessagesFromBody(body);

    expect(result).toEqual([
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ]);
  });

  it("filters out invalid roles like tool and function", () => {
    const body = {
      messages: [
        { role: "user", content: "Hello" },
        { role: "tool", content: "tool output" },
        { role: "function", content: "function output" },
        { role: "assistant", content: "Reply" },
      ],
    };

    const result = getMessagesFromBody(body);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ role: "user", content: "Hello" });
    expect(result[1]).toEqual({ role: "assistant", content: "Reply" });
  });

  it("handles content as a parts array with text type", () => {
    const body = {
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: "hello from parts" }],
        },
      ],
    };

    const result = getMessagesFromBody(body);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("hello from parts");
  });

  it("handles content as parts with reasoning type", () => {
    const body = {
      messages: [
        {
          role: "assistant",
          content: [
            { type: "reasoning", reasoning: "thinking step" },
            { type: "text", text: "final answer" },
          ],
        },
      ],
    };

    const result = getMessagesFromBody(body);

    expect(result).toHaveLength(1);
    expect(result[0].content).toContain("thinking step");
    expect(result[0].content).toContain("final answer");
  });

  it("returns empty array for non-object body", () => {
    expect(getMessagesFromBody("string")).toEqual([]);
    expect(getMessagesFromBody(42)).toEqual([]);
    expect(getMessagesFromBody(true)).toEqual([]);
  });

  it("returns empty array for null and undefined body", () => {
    expect(getMessagesFromBody(null)).toEqual([]);
    expect(getMessagesFromBody(undefined)).toEqual([]);
  });

  it("returns empty array when messages field is missing", () => {
    expect(getMessagesFromBody({})).toEqual([]);
    expect(getMessagesFromBody({ input: "hello" })).toEqual([]);
  });

  it("filters messages with empty content", () => {
    const body = {
      messages: [
        { role: "user", content: "" },
        { role: "user", content: "real message" },
        { role: "assistant", content: "" },
      ],
    };

    const result = getMessagesFromBody(body);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("real message");
  });
});

describe("getLastUserMessage", () => {
  it("returns last user message from a mixed conversation", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "System prompt" },
      { role: "user", content: "First question" },
      { role: "assistant", content: "First answer" },
      { role: "user", content: "Second question" },
      { role: "assistant", content: "Second answer" },
    ];

    const result = getLastUserMessage(messages);

    expect(result).toBe("Second question");
  });

  it("returns empty string when no user messages exist", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "System prompt" },
      { role: "assistant", content: "Hello" },
    ];

    expect(getLastUserMessage(messages)).toBe("");
  });

  it("returns empty string for an empty array", () => {
    expect(getLastUserMessage([])).toBe("");
  });
});

describe("extractInlinePrompt", () => {
  it("extracts from the input field", () => {
    const body = { input: "summarize this" };

    expect(extractInlinePrompt(body)).toBe("summarize this");
  });

  it("extracts from the content field when input is absent", () => {
    const body = { content: "explain this" };

    expect(extractInlinePrompt(body)).toBe("explain this");
  });

  it("prefers input over content when both are present", () => {
    const body = { input: "from input", content: "from content" };

    expect(extractInlinePrompt(body)).toBe("from input");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(extractInlinePrompt({ input: "   " })).toBe("");
  });

  it("returns empty string for whitespace-only content", () => {
    expect(extractInlinePrompt({ content: "  \t\n  " })).toBe("");
  });

  it("falls back to content when input is whitespace-only", () => {
    const body = { input: "   ", content: "real content" };

    expect(extractInlinePrompt(body)).toBe("real content");
  });

  it("returns empty string for non-object body", () => {
    expect(extractInlinePrompt(null)).toBe("");
    expect(extractInlinePrompt(42)).toBe("");
  });
});

describe("safeJsonPreview", () => {
  it("returns full JSON for small values", () => {
    expect(safeJsonPreview({ a: 1 })).toBe('{"a":1}');
  });

  it("truncates strings exceeding the limit", () => {
    const longValue = { data: "x".repeat(600) };
    const result = safeJsonPreview(longValue, 100);

    expect(result.length).toBeLessThanOrEqual(101); // 100 chars + ellipsis
    expect(result).toEndWith("\u2026");
  });

  it("respects a custom limit", () => {
    const result = safeJsonPreview({ key: "value" }, 5);

    expect(result).toBe('{"key\u2026');
  });

  it("handles circular references gracefully", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(safeJsonPreview(circular)).toBe("(unserializable)");
  });
});
