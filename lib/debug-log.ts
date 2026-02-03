/* eslint-disable import/no-nodejs-modules */
import { appendFile } from "node:fs/promises";

const LOG_PATH = `${process.cwd()}/debug.log`;

interface DebugEntry {
  ts: string;
  event: string;
  data?: unknown;
}

const REDACT_KEYS = [/token/i, /authorization/i, /cookie/i];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPrimitive(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function sanitizeObjectEntry(key: string, val: unknown): [string, unknown] {
  const shouldRedact = REDACT_KEYS.some((pattern) => pattern.test(key));
  return [key, shouldRedact ? "[redacted]" : sanitizeForLog(val)];
}

function sanitizeObject(value: Record<string, unknown>): unknown {
  const entries = Object.entries(value).map(([key, val]) =>
    sanitizeObjectEntry(key, val)
  );
  return Object.fromEntries(entries);
}

function sanitizeForLog(value: unknown): unknown {
  if (isPrimitive(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item));
  }
  if (isPlainObject(value)) {
    return sanitizeObject(value);
  }
  return Object.prototype.toString.call(value);
}

export async function writeDebugLog(
  event: string,
  data?: Record<string, unknown>
): Promise<void> {
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
