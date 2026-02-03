/**
 * Debug logging utilities that sanitize sensitive data before writing to disk.
 */

/* eslint-disable import/no-nodejs-modules */
import { appendFile } from "node:fs/promises";

const LOG_PATH = `${process.cwd()}/debug.log`;

interface DebugEntry {
  ts: string;
  event: string;
  data?: unknown;
}

const REDACT_KEYS = [/token/i, /authorization/i, /cookie/i];

/**
 * Type guard for plain objects.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Type guard for primitive values.
 */
function isPrimitive(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/**
 * Sanitize a single object entry, redacting sensitive keys.
 */
function sanitizeObjectEntry(key: string, val: unknown): [string, unknown] {
  const shouldRedact = REDACT_KEYS.some((pattern) => pattern.test(key));
  return [key, shouldRedact ? "[redacted]" : sanitizeForLog(val)];
}

/**
 * Recursively sanitize all entries in an object.
 */
function sanitizeObject(value: Record<string, unknown>) {
  const entries = Object.entries(value).map(([key, val]) =>
    sanitizeObjectEntry(key, val)
  );
  return Object.fromEntries(entries);
}

/**
 * Recursively sanitize a value for logging, handling nested structures.
 */
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

/**
 * Write a debug entry to the log file with automatic sanitization of sensitive data.
 */
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
    console.error("[debug.log] append failed", error);
  }
}
