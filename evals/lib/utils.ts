/**
 * Shared utility functions for the eval system.
 */

import { readFileSync } from "node:fs";

/**
 * Type guard for plain objects (non-array, non-null objects).
 */
export function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Type guard for non-empty strings.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Normalize text for fuzzy matching by lowercasing, removing punctuation, and collapsing whitespace.
 * Allows "Wi-Fi" to match "wifi", "de-auth" to match "deauth", etc.
 */
export function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .replaceAll(/[-_]/g, "")
    .replaceAll(/[^\w\s]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

/**
 * Deep merge two JSON values, with override taking precedence.
 * Arrays and primitives are replaced entirely; objects are merged recursively.
 */
export function deepMerge(base: unknown, override: unknown): unknown {
  if (override === undefined) {
    return base;
  }
  if (base === undefined) {
    return override;
  }
  if (isPlainObject(base) && isPlainObject(override)) {
    const result: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(override)) {
      result[key] = deepMerge(result[key], value);
    }
    return result;
  }
  return override;
}

/**
 * Load and parse a JSON file from disk.
 */
export function loadJsonFile(filePath: string): unknown {
  const contents = readFileSync(filePath, "utf8");
  return JSON.parse(contents) as unknown;
}
