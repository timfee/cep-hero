import { z } from "zod";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const MessagePartSchema = z.object({
  type: z.string().optional(),
  text: z.string().optional(),
  reasoning: z.string().optional(),
});

const MessageSchema = z.object({
  role: z.string(),
  content: z.union([z.string(), z.array(MessagePartSchema)]).optional(),
  parts: z.array(MessagePartSchema).optional(),
});

const BodySchema = z.object({
  messages: z.array(z.unknown()).optional(),
  input: z.string().optional(),
  content: z.string().optional(),
});

// Returns the most recent user message content (or empty string).
export function getLastUserMessage(messages: ChatMessage[]): string {
  const lastUser = [...messages]
    .toReversed()
    .find((message) => message.role === "user");

  return lastUser?.content ?? "";
}

export function getMessagesFromBody(body: unknown): ChatMessage[] {
  const parsed = BodySchema.safeParse(body);

  if (!parsed.success || !parsed.data.messages) {
    return [];
  }

  return parsed.data.messages
    .map((msgRaw) => {
      const parsedMsg = MessageSchema.safeParse(msgRaw);
      if (!parsedMsg.success) {
        return null;
      }

      const { role } = parsedMsg.data;
      if (role !== "system" && role !== "user" && role !== "assistant") {
        return null;
      }

      return normalizeMessage(parsedMsg.data);
    })
    .filter((msg): msg is ChatMessage => msg !== null);
}

// Extracts a prompt string from `input` or `content` when messages are missing.
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

// Stringifies a value for logs with a size limit.
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
  const content = stringifyContent(value.content ?? value.parts);

  if (content.length === 0) {
    return null;
  }

  if (
    value.role !== "system" &&
    value.role !== "user" &&
    value.role !== "assistant"
  ) {
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
    const parts = raw
      .map((item) => MessagePartSchema.safeParse(item))
      .filter((result) => result.success)
      .map((result) => result.data);

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
      .filter((part) => part.length > 0);

    return textParts.join("\n").trim();
  }

  return "";
}
