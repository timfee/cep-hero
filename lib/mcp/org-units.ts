export interface OrgUnit {
  orgUnitId?: string | null;
  parentOrgUnitId?: string | null;
  orgUnitPath?: string | null;
  name?: string | null;
}

/**
 * Normalize org unit and policy resources for consistent lookups.
 */
export function normalizeResource(value: string): string {
  const trimmed = value.trim();
  const stripped = trimmed.replace(/^id:/, "");
  const collapsed = stripped.replaceAll(/\/{2,}/g, "/");
  return collapsed
    .replace(/^orgunits\//i, "orgunits/")
    .replace(/^customers\//i, "customers/");
}

/**
 * Build a mapping from org unit ID variants to friendly paths.
 * Handles multiple ID formats: "03ph8a2z...", "id:03ph8a2z...", "orgunits/03ph8a2z..."
 */
export function buildOrgUnitNameMap(units: OrgUnit[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const unit of units) {
    const path = unit.orgUnitPath ?? unit.name ?? "";
    if (!path) {
      continue;
    }

    const rawId = unit.orgUnitId ?? "";
    if (!rawId) {
      continue;
    }

    // Store under multiple key formats for easy lookup
    const normalizedId = normalizeResource(rawId);
    map.set(normalizedId, path);
    map.set(`orgunits/${normalizedId}`, path);
    map.set(`id:${normalizedId}`, path);
  }

  return map;
}

export function resolveOrgUnitDisplay(
  value: string | null | undefined,
  map: Map<string, string>,
  rootOrgUnitId?: string | null,
  rootOrgUnitPath?: string | null
): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  const normalized = normalizeResource(trimmed);
  if (rootOrgUnitId && rootOrgUnitPath) {
    const normalizedRoot = normalizeResource(rootOrgUnitId);
    if (
      normalized === normalizedRoot ||
      normalized === `orgunits/${normalizedRoot}`
    ) {
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
