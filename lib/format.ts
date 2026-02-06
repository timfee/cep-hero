/**
 * Shared formatting utilities for policy values and identifiers.
 */

/**
 * Converts a camelCase or SCREAMING_SNAKE_CASE key into a readable label.
 */
export function humanizeKey(key: string): string {
  return key
    .replaceAll("_", " ")
    .replaceAll(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Summarises an array value into a human-readable string.
 */
function formatArrayValue(value: unknown[]): string {
  if (value.length === 0) {
    return "None";
  }
  if (value.length === 1 && typeof value[0] === "string") {
    return value[0];
  }
  return `${value.length} ${value.length === 1 ? "item" : "items"} configured`;
}

/**
 * Summarises a plain object value into a human-readable string.
 */
function formatObjectValue(value: Record<string, unknown>): string {
  const keys = Object.keys(value);
  if (keys.length === 0) {
    return "Empty";
  }
  if (keys.length <= 2) {
    return keys.map((k) => humanizeKey(k)).join(", ");
  }
  return `${keys.length} settings`;
}

/**
 * Renders a policy value as a short, human-readable string.
 * Complex objects/arrays are summarised rather than dumped as JSON.
 */
export function formatPolicyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "Not set";
  }
  if (typeof value === "boolean") {
    return value ? "Enabled" : "Disabled";
  }
  if (typeof value === "number" || typeof value === "string") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return formatArrayValue(value);
  }
  if (typeof value === "object") {
    return formatObjectValue(value as Record<string, unknown>);
  }
  return String(value);
}
