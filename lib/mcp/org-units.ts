/**
 * Utilities for normalizing and resolving organizational unit identifiers.
 */

/**
 * Minimal org unit representation for lookups.
 */
export interface OrgUnit {
  orgUnitId?: string | null;
  parentOrgUnitId?: string | null;
  orgUnitPath?: string | null;
  name?: string | null;
}

/**
 * Normalizes org unit resource identifiers for consistent lookups. Strips
 * "id:" prefixes, collapses duplicate slashes, and lowercases prefixes.
 */
export function normalizeResource(value: string) {
  return value
    .trim()
    .replace(/^id:/, "")
    .replaceAll(/\/{2,}/g, "/")
    .replace(/^orgunits\//i, "orgunits/")
    .replace(/^customers\//i, "customers/");
}

/**
 * Type guard for non-empty strings.
 */
function hasContent(value: string | null | undefined): value is string {
  return !!value;
}

/**
 * Builds a lookup map from org unit IDs to their display paths. Indexes each
 * unit under multiple key formats for flexible resolution.
 */
export function buildOrgUnitNameMap(units: OrgUnit[]) {
  const map = new Map<string, string>();

  for (const unit of units) {
    addUnitToMap(map, unit);
  }

  return map;
}

/**
 * Adds an org unit to the lookup map under multiple key formats.
 */
function addUnitToMap(map: Map<string, string>, unit: OrgUnit) {
  const path = unit.orgUnitPath ?? unit.name;
  const rawId = unit.orgUnitId;

  if (!hasContent(path) || !hasContent(rawId)) {
    return;
  }

  const normalizedId = normalizeResource(rawId);
  map.set(normalizedId, path);
  map.set(`orgunits/${normalizedId}`, path);
  map.set(`id:${normalizedId}`, path);
}

/**
 * Resolves an org unit identifier to its human-readable path. Handles direct
 * paths (starting with "/"), root org unit special cases, and ID lookups.
 * Returns "/ (Root)" instead of bare "/" so root is always clearly labeled.
 */
export function resolveOrgUnitDisplay(
  value: string | null | undefined,
  map: Map<string, string>,
  rootOrgUnitId?: string | null,
  rootOrgUnitPath?: string | null
) {
  if (!hasContent(value)) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.startsWith("/")) {
    return friendlyPath(trimmed);
  }

  return lookupOrgUnit(trimmed, map, rootOrgUnitId, rootOrgUnitPath);
}

/**
 * Labels bare "/" as "/ (Root)" so the root org unit is always identifiable.
 */
function friendlyPath(path: string) {
  return path === "/" ? "/ (Root)" : path;
}

/**
 * Looks up an org unit by normalized ID, with special handling for the root.
 */
function lookupOrgUnit(
  value: string,
  map: Map<string, string>,
  rootOrgUnitId: string | null | undefined,
  rootOrgUnitPath: string | null | undefined
) {
  const normalized = normalizeResource(value);

  if (hasContent(rootOrgUnitId) && hasContent(rootOrgUnitPath)) {
    const normalizedRoot = normalizeResource(rootOrgUnitId);
    const isRoot =
      normalized === normalizedRoot ||
      normalized === `orgunits/${normalizedRoot}`;
    if (isRoot) {
      return friendlyPath(rootOrgUnitPath);
    }
  }

  const resolved = map.get(normalized);
  return resolved === undefined ? null : friendlyPath(resolved);
}

/**
 * Extracts the leaf segment from an org unit path for use as a friendly name.
 * "/Sales/West Coast" → "West Coast", "/" → "/"
 */
export function leafName(path: string): string {
  if (!path || path === "/") {
    return "/";
  }

  const segments = path.split("/").filter(Boolean);
  return segments.at(-1) ?? path;
}

/**
 * Replaces org unit ID patterns in a string with human-readable paths.
 * Handles "orgunits/abc123" and "id:abc123" patterns found in tool JSON output.
 */
export function sanitizeOrgUnitIds(
  text: string,
  pathMap: Map<string, { path: string }>
): string {
  if (pathMap.size === 0) {
    return text;
  }

  return text.replaceAll(/(?:orgunits\/|id:)[a-z0-9_-]+/gi, (match) => {
    const normalized = normalizeResource(match);
    const info = pathMap.get(normalized);
    if (info) {
      return info.path;
    }

    if (!normalized.startsWith("orgunits/")) {
      const withPrefix = `orgunits/${normalized}`;
      const prefixInfo = pathMap.get(withPrefix);
      if (prefixInfo) {
        return prefixInfo.path;
      }
    }

    return match;
  });
}

/**
 * Builds a policy target resource string from an org unit identifier.
 * Returns empty string if the input is invalid or missing the org unit ID.
 */
export function buildOrgUnitTargetResource(value: string) {
  const normalized = normalizeResource(value);
  if (!normalized || normalized === "/") {
    return "";
  }
  const withoutLeading = normalized.startsWith("/")
    ? normalized.slice(1)
    : normalized;

  // Handle prefixed resources
  if (withoutLeading.startsWith("orgunits/")) {
    const orgUnitId = withoutLeading.slice("orgunits/".length);
    if (!orgUnitId) {
      return "";
    }
    return normalizeResource(withoutLeading);
  }
  if (withoutLeading.startsWith("customers/")) {
    return "";
  }

  return normalizeResource(`orgunits/${withoutLeading}`);
}
