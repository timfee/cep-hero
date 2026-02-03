/**
 * Format a Cloud Identity setting type into a human-readable name.
 * Example: "settings/security.password" -> "Security: Password"
 */
export function formatSettingType(settingType: string): string {
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

function formatSettingParts(parts: string[]): string {
  const [category, ...settingParts] = parts;
  const capitalizedCategory = capitalizeFirst(category ?? "");

  if (settingParts.length === 0) {
    return capitalizedCategory;
  }

  const settingName = settingParts.map(capitalizeFirst).join(" ");
  return `${capitalizedCategory}: ${settingName}`;
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format a Cloud Identity setting value into a readable summary.
 */
export function formatSettingValue(value: Record<string, unknown>): string {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return "";
  }

  if (entries.length <= 3) {
    return formatSmallSettingValue(entries);
  }

  return `${entries.length} settings configured`;
}

function formatSmallSettingValue(entries: [string, unknown][]): string {
  return entries.map(formatSettingEntry).join(", ");
}

function formatSettingEntry([key, value]: [string, unknown]): string {
  const formattedValue = formatSingleValue(value);
  return `${key}: ${formattedValue}`;
}

function formatSingleValue(value: unknown): string {
  if (typeof value === "boolean") {
    return value ? "enabled" : "disabled";
  }
  return String(value);
}
