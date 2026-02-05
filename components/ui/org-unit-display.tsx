/**
 * Reusable component for displaying org units with name + ID pill format.
 * Ensures consistent structured display of org unit identifiers across the app.
 */

import { cn } from "@/lib/utils";

interface OrgUnitDisplayProps {
  /** The display name or path (e.g., "/Engineering" or "Engineering") */
  name?: string | null;
  /** The org unit ID (e.g., "03ph8a2z23yjui6" or "orgunits/03ph8a2z23yjui6") */
  id?: string | null;
  /** The full targetResource string if name/id not separately available */
  targetResource?: string | null;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: "sm" | "md";
}

/**
 * Extracts the org unit ID from various formats.
 * Handles: "orgunits/abc123", "id:abc123", "abc123"
 */
function extractOrgUnitId(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  // Remove "orgunits/" prefix
  if (value.startsWith("orgunits/")) {
    return value.slice("orgunits/".length) || null;
  }
  // Remove "id:" prefix
  if (value.startsWith("id:")) {
    return value.slice(3) || null;
  }
  // If it looks like a path (starts with /), don't treat as ID
  if (value.startsWith("/")) {
    return null;
  }
  // Return as-is if it looks like an ID (alphanumeric)
  if (/^[a-zA-Z0-9]+$/.test(value)) {
    return value;
  }
  return null;
}

/**
 * Formats the display name from various inputs.
 */
function formatDisplayName(
  name: string | null | undefined,
  targetResource: string | null | undefined
): string {
  if (name) {
    return name;
  }
  if (targetResource) {
    // If targetResource is a path like "/Engineering", return it
    if (targetResource.startsWith("/")) {
      return targetResource;
    }
    // If it's "orgunits/abc123", show root indicator
    if (targetResource.startsWith("orgunits/")) {
      return "/";
    }
    // If it's "customers/C123", show customer
    if (targetResource.startsWith("customers/")) {
      return "Organization";
    }
  }
  return "/";
}

/**
 * Displays an org unit with a friendly name and ID pill.
 * Consistent format: "Name/Path [id-pill]"
 */
export function OrgUnitDisplay({
  name,
  id,
  targetResource,
  className,
  size = "sm",
}: OrgUnitDisplayProps) {
  const displayName = formatDisplayName(name, targetResource);
  const orgUnitId = id
    ? extractOrgUnitId(id)
    : extractOrgUnitId(targetResource);

  const textSize = size === "sm" ? "text-xs" : "text-sm";
  const pillSize = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn(textSize, "text-foreground")}>{displayName}</span>
      {orgUnitId && (
        <span
          className={cn(
            pillSize,
            "text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded"
          )}
        >
          {orgUnitId}
        </span>
      )}
    </span>
  );
}
