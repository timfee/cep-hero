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
export function normalizeResource(value: string): string {
  return value
    .trim()
    .replace(/^id:/, "")
    .replaceAll(/\/{2,}/g, "/")
    .replace(/^orgunits\//i, "orgunits/")
    .replace(/^customers\//i, "customers/");
}

function hasContent(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Builds a lookup map from org unit IDs to their display paths. Indexes each
 * unit under multiple key formats for flexible resolution.
 */
export function buildOrgUnitNameMap(units: OrgUnit[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const unit of units) {
    addUnitToMap(map, unit);
  }

  return map;
}

function addUnitToMap(map: Map<string, string>, unit: OrgUnit): void {
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
 */
export function resolveOrgUnitDisplay(
  value: string | null | undefined,
  map: Map<string, string>,
  rootOrgUnitId?: string | null,
  rootOrgUnitPath?: string | null
): string | null {
  if (!hasContent(value)) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  return lookupOrgUnit(trimmed, map, rootOrgUnitId, rootOrgUnitPath);
}

function lookupOrgUnit(
  value: string,
  map: Map<string, string>,
  rootOrgUnitId: string | null | undefined,
  rootOrgUnitPath: string | null | undefined
): string | null {
  const normalized = normalizeResource(value);

  if (hasContent(rootOrgUnitId) && hasContent(rootOrgUnitPath)) {
    const normalizedRoot = normalizeResource(rootOrgUnitId);
    const isRoot =
      normalized === normalizedRoot ||
      normalized === `orgunits/${normalizedRoot}`;
    if (isRoot) {
      return rootOrgUnitPath;
    }
  }

  return map.get(normalized) ?? null;
}

export function buildOrgUnitTargetResource(value: string): string {
  const normalized = normalizeResource(value);
  if (!normalized || normalized === "/") {
    return "";
  }
  const withoutLeading = normalized.startsWith("/")
    ? normalized.slice(1)
    : normalized;
  if (
    withoutLeading.startsWith("orgunits/") ||
    withoutLeading.startsWith("customers/")
  ) {
    return normalizeResource(withoutLeading);
  }
  return normalizeResource(`orgunits/${withoutLeading}`);
}
