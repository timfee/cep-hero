/**
 * Reusable inline component for displaying org units as friendly name + path.
 * Uses OrgUnitMapContext to resolve raw IDs to human-readable names and paths,
 * rendering as lightweight inline text rather than block-level elements.
 */

"use client";

import { leafName, normalizeResource } from "@/lib/mcp/org-units";
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
 * Displays an org unit inline as friendly name + optional parenthetical path.
 * Format: "Engineering" or "West Coast (/Sales/West Coast)"
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

  // Show path context when it provides info beyond the display name alone.
  // Skip for simple single-segment paths where name and path are redundant.
  const showPath =
    path !== null && path !== displayName && !(path === `/${displayName}`);

  return (
    <span className={cn("inline", textSize, className)}>
      <span className="font-medium text-foreground">{displayName}</span>
      {showPath && <span className="text-muted-foreground"> ({path})</span>}
    </span>
  );
}
