export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * Extract the most recent user message content.
 */
export function getLastUserMessage(messages: ChatMessage[]): string {
  const lastUser = [...messages]
    .reverse()
    .find((message) => message.role === "user");
  return lastUser?.content ?? "";
}

export function getMessagesFromBody(body: unknown): ChatMessage[] {
  if (!body || typeof body !== "object") {
    return [];
  }

  const messages = Reflect.get(body, "messages");
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((message) => normalizeMessage(message))
    .filter(Boolean) as ChatMessage[];
}

function normalizeMessage(value: unknown): ChatMessage | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const role = Reflect.get(value, "role");
  const rawContent = Reflect.get(value, "content") as unknown;
  const rawParts = Reflect.get(value, "parts") as unknown;

  if (role !== "system" && role !== "user" && role !== "assistant") {
    return null;
  }

  const content = stringifyContent(rawContent ?? rawParts);
  if (!content) {
    return null;
  }

  return { role, content };
}

function stringifyContent(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    const textParts = raw
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        const type = Reflect.get(part, "type");
        const text = Reflect.get(part, "text");
        if (type === "text" && typeof text === "string") return text;
        const reasoning = Reflect.get(part, "reasoning");
        if (type === "reasoning" && typeof reasoning === "string") {
          return reasoning;
        }
        return "";
      })
      .filter(Boolean);
    return textParts.join("\n").trim();
  }
  return "";
}

export function safeJsonPreview(value: unknown, limit = 500): string {
  try {
    const str = JSON.stringify(value);
    return str.length > limit ? `${str.slice(0, limit)}…` : str;
  } catch {
    return "(unserializable)";
  }
}

export function extractInlinePrompt(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const maybeInput = Reflect.get(body as object, "input");
  if (typeof maybeInput === "string" && maybeInput.trim()) return maybeInput;
  const maybeContent = Reflect.get(body as object, "content");
  if (typeof maybeContent === "string" && maybeContent.trim())
    return maybeContent;
  return "";
}
