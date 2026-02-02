import { z } from "zod";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const MessagePartSchema = z.object({
  type: z.string().optional(),
  text: z.string().optional(),
  reasoning: z.string().optional(),
});

const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.union([z.string(), z.array(MessagePartSchema)]),
  parts: z.array(MessagePartSchema).optional(),
});

const BodySchema = z.object({
  messages: z.array(MessageSchema).optional(),
  input: z.string().optional(),
  content: z.string().optional(),
});

/**
 * Extract the most recent user message content from a list of messages.
 *
 * @param messages - The list of chat messages.
 * @returns The content of the last message with role 'user', or an empty string.
 */
export function getLastUserMessage(messages: ChatMessage[]): string {
  const lastUser = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  return lastUser?.content ?? "";
}

/**
 * Parse and normalize chat messages from a request body.
 *
 * @param body - The raw request body.
 * @returns An array of normalized ChatMessage objects.
 */
export function getMessagesFromBody(body: unknown): ChatMessage[] {
  const parsed = BodySchema.safeParse(body);

  if (!parsed.success || !parsed.data.messages) {
    return [];
  }

  return parsed.data.messages
    .map(normalizeMessage)
    .filter((msg): msg is ChatMessage => msg !== null);
}

/**
 * Extract a simple prompt string from the body if messages are missing.
 * Supports 'input' or 'content' fields.
 *
 * @param body - The raw request body.
 * @returns The extracted prompt string, or empty string if not found.
 */
export function extractInlinePrompt(body: unknown): string {
  const parsed = BodySchema.safeParse(body);

  if (!parsed.success) {
    return "";
  }

  const { input, content } = parsed.data;

  if (typeof input === "string" && input.trim()) {
    return input;
  }

  if (typeof content === "string" && content.trim()) {
    return content;
  }

  return "";
}

/**
 * Safely preview a JSON object as a string, truncated to a limit.
 * Useful for logging without flooding the console.
 *
 * @param value - The value to stringify.
 * @param limit - Max length of the output string (default 500).
 */
export function safeJsonPreview(value: unknown, limit = 500): string {
  try {
    const str = JSON.stringify(value);
    return str.length > limit ? `${str.slice(0, limit)}…` : str;
  } catch {
    return "(unserializable)";
  }
}

function normalizeMessage(
  value: z.infer<typeof MessageSchema>
): ChatMessage | null {
  const content = stringifyContent(value.content || value.parts);

  if (!content) {
    return null;
  }

  return {
    role: value.role,
    content,
  };
}

function stringifyContent(raw: unknown): string {
  if (typeof raw === "string") {
    return raw;
  }

  if (Array.isArray(raw)) {
    const parts = raw as z.infer<typeof MessagePartSchema>[];

    const textParts = parts
      .map((part) => {
        if (part.type === "text" && typeof part.text === "string") {
          return part.text;
        }

        if (part.type === "reasoning" && typeof part.reasoning === "string") {
          return part.reasoning;
        }

        // Fallback: if no type is specified but text exists
        if (typeof part.text === "string") {
          return part.text;
        }

        return "";
      })
      .filter(Boolean);

    return textParts.join("\n").trim();
  }

  return "";
}
