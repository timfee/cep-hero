/**
 * Utility functions for org unit target resource resolution in Chrome Policy API calls.
 */

import { normalizeResource, type OrgUnit } from "@/lib/mcp/org-units";

/**
 * Resolves candidate org unit IDs for Chrome Policy API calls.
 */
export function resolveOrgUnitCandidates(units: OrgUnit[]) {
  if (units.length === 0) {
    return [];
  }

  const candidates: string[] = [];
  const seen = new Set<string>();

  addRootCandidate(units, candidates, seen);
  addChildCandidates(units, candidates, seen);

  return candidates;
}

/**
 * Adds the inferred root org unit as the first candidate.
 */
function addRootCandidate(
  units: OrgUnit[],
  candidates: string[],
  seen: Set<string>
) {
  const [firstUnit] = units;
  const rootId = normalizeResource(
    firstUnit?.parentOrgUnitId ?? firstUnit?.orgUnitId ?? ""
  );
  if (rootId !== "" && !seen.has(rootId)) {
    candidates.push(rootId);
    seen.add(rootId);
  }
}

/**
 * Adds first few child org units as fallback candidates.
 */
function addChildCandidates(
  units: OrgUnit[],
  candidates: string[],
  seen: Set<string>
) {
  for (const unit of units.slice(0, 3)) {
    const childId = normalizeResource(unit.orgUnitId ?? "");
    if (childId !== "" && !seen.has(childId)) {
      candidates.push(childId);
      seen.add(childId);
    }
  }
}
