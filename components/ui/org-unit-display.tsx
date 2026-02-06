/**
 * Reusable component for displaying org units as friendly name + path pill.
 * Uses OrgUnitMapContext to resolve raw IDs to human-readable names and paths,
 * ensuring consistent structured display across the entire app.
 */

"use client";

import { normalizeResource } from "@/lib/mcp/org-units";
import { cn } from "@/lib/utils";

import { useOrgUnitMap, type OrgUnitInfo } from "./org-unit-context";

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
 * Extracts the leaf name from an org unit path.
 * "/Sales/West Coast" → "West Coast", "/" → "/"
 */
function leafName(path: string): string {
  if (path === "/") {
    return "/";
  }

  const segments = path.split("/").filter(Boolean);
  return segments.at(-1) ?? path;
}

/**
 * Builds candidate lookup keys for the context map from the provided props.
 * Tries id and targetResource in multiple normalized formats.
 */
function buildLookupKeys(
  id: string | null | undefined,
  targetResource: string | null | undefined
): string[] {
  const keys: string[] = [];

  for (const raw of [id, targetResource]) {
    if (!raw || raw.startsWith("/")) {
      continue;
    }

    const normalized = normalizeResource(raw);
    keys.push(normalized);

    if (!normalized.startsWith("orgunits/")) {
      keys.push(`orgunits/${normalized}`);
    }
  }

  return keys;
}

/**
 * Attempts to resolve org unit info by looking up IDs in the context map.
 */
function lookupFromContext(
  keys: string[],
  contextMap: Map<string, OrgUnitInfo>
): OrgUnitInfo | null {
  for (const key of keys) {
    const info = contextMap.get(key);
    if (info) {
      return info;
    }
  }

  return null;
}

/**
 * Resolves the display name and path from props and context.
 * Priority: context resolution > explicit name prop > targetResource parsing > fallback.
 */
function resolveOrgUnit(
  props: OrgUnitDisplayProps,
  contextMap: Map<string, OrgUnitInfo>
): { displayName: string; path: string | null } {
  const { name, id, targetResource } = props;

  // Try context-based resolution first
  const lookupKeys = buildLookupKeys(id, targetResource);
  const resolved = lookupFromContext(lookupKeys, contextMap);

  if (resolved) {
    const displayName =
      name && !name.startsWith("orgunits/") ? name : resolved.name;
    return {
      displayName: displayName.startsWith("/")
        ? leafName(displayName)
        : displayName,
      path: resolved.path,
    };
  }

  // No context match — work with props directly

  if (name?.startsWith("/")) {
    return { displayName: leafName(name), path: name };
  }

  if (name) {
    return { displayName: name, path: null };
  }

  if (targetResource?.startsWith("/")) {
    return { displayName: leafName(targetResource), path: targetResource };
  }

  if (targetResource?.startsWith("customers/")) {
    return { displayName: "Organization", path: null };
  }

  if (targetResource?.startsWith("orgunits/")) {
    return { displayName: "/", path: null };
  }

  if (targetResource) {
    return { displayName: targetResource, path: null };
  }

  return { displayName: "/", path: null };
}

/**
 * Displays an org unit as friendly name + optional path pill.
 * Format: "Engineering (/Engineering)" or "West Coast (/Sales/West Coast)"
 *
 * When an OrgUnitMapProvider is present in the tree, raw org unit IDs are
 * automatically resolved to human-readable names and paths.
 */
export function OrgUnitDisplay({
  name,
  id,
  targetResource,
  className,
  size = "sm",
}: OrgUnitDisplayProps) {
  const contextMap = useOrgUnitMap();
  const { displayName, path } = resolveOrgUnit(
    { name, id, targetResource },
    contextMap
  );

  const textSize = size === "sm" ? "text-xs" : "text-sm";
  const pillSize = size === "sm" ? "text-[10px]" : "text-xs";

  // Show path pill when it provides context beyond the display name alone.
  // Skip the pill for simple single-segment paths where name and path
  // convey the same information (e.g., "Engineering" + "/Engineering").
  const showPill =
    path !== null && path !== displayName && !(path === `/${displayName}`);

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn(textSize, "text-foreground")}>{displayName}</span>
      {showPill && (
        <span
          className={cn(
            pillSize,
            "text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
          )}
        >
          {path}
        </span>
      )}
    </span>
  );
}
