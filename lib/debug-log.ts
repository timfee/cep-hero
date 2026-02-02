import { appendFile } from "node:fs/promises";

const LOG_PATH = `${process.cwd()}/debug.log`;

type DebugEntry = {
  ts: string;
  event: string;
  data?: unknown;
};

const REDACT_KEYS = [/token/i, /authorization/i, /cookie/i];

function sanitizeForLog(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, val]) => {
        const shouldRedact = REDACT_KEYS.some((pattern) => pattern.test(key));
        return [key, shouldRedact ? "[redacted]" : sanitizeForLog(val)];
      }
    );
    return Object.fromEntries(entries);
  }
  return String(value);
}

export async function writeDebugLog(
  event: string,
  data?: Record<string, unknown>
) {
  const entry: DebugEntry = {
    ts: new Date().toISOString(),
    event,
    data: data ? sanitizeForLog(data) : undefined,
  };

  try {
    await appendFile(LOG_PATH, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (error) {
    // Swallow logging errors to avoid breaking the request path.
    console.error("[debug.log] append failed", error);
  }
}
