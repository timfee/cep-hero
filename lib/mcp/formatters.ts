/**
 * Human-readable formatting utilities for Cloud Identity settings.
 */

/**
 * Formats a Cloud Identity setting type into a human-readable name.
 */
export function formatSettingType(settingType: string) {
  if (!settingType) {
    return "";
  }

  const withoutPrefix = settingType.replace(/^settings\//, "");
  const parts = withoutPrefix.split(/[._]/);

  if (parts.length === 0) {
    return withoutPrefix;
  }

  return formatSettingParts(parts);
}

/**
 * Joins category and setting parts into a formatted string.
 */
function formatSettingParts(parts: string[]) {
  const [category, ...settingParts] = parts;
  const capitalizedCategory = capitalizeFirst(category ?? "");

  if (settingParts.length === 0) {
    return capitalizedCategory;
  }

  const settingName = settingParts.map(capitalizeFirst).join(" ");
  return `${capitalizedCategory}: ${settingName}`;
}

/**
 * Capitalizes the first character of a string.
 */
function capitalizeFirst(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Formats a Cloud Identity setting value into a readable summary.
 */
export function formatSettingValue(value: Record<string, unknown>) {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return "";
  }

  if (entries.length <= 3) {
    return formatSmallSettingValue(entries);
  }

  return `${entries.length} settings configured`;
}

/**
 * Formats a small number of setting entries as a comma-separated list.
 */
function formatSmallSettingValue(entries: [string, unknown][]) {
  return entries.map(formatSettingEntry).join(", ");
}

/**
 * Formats a single key-value pair for display.
 */
function formatSettingEntry([key, value]: [string, unknown]) {
  const formattedValue = formatSingleValue(value);
  return `${key}: ${formattedValue}`;
}

/**
 * Converts a value to a display string, with boolean-specific formatting.
 * Handles arrays and nested objects instead of producing "[object Object]".
 */
function formatSingleValue(value: unknown): string {
  if (typeof value === "boolean") {
    return value ? "enabled" : "disabled";
  }

  if (Array.isArray(value)) {
    return value.map(formatSingleValue).join(", ");
  }

  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }

  return String(value);
}
