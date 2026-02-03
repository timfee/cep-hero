import {
  buildOrgUnitTargetResource as coreBuildOrgUnitTargetResource,
  normalizeResource,
  type OrgUnit,
} from "@/lib/mcp/org-units";

/**
 * Build a target resource path for Chrome Policy API.
 * Delegates to the canonical implementation in org-units.ts.
 */
export function buildOrgUnitTargetResource(orgUnitId: string): string {
  return coreBuildOrgUnitTargetResource(orgUnitId);
}

/**
 * Resolve org unit IDs to try for Chrome Policy API.
 */
export function resolveOrgUnitCandidates(units: OrgUnit[]): string[] {
  if (units.length === 0) {
    return [];
  }

  const candidates: string[] = [];
  const seen = new Set<string>();

  addRootCandidate(units, candidates, seen);
  addChildCandidates(units, candidates, seen);

  return candidates;
}

function addRootCandidate(
  units: OrgUnit[],
  candidates: string[],
  seen: Set<string>
): void {
  const [firstUnit] = units;
  const rootId = normalizeResource(
    firstUnit?.parentOrgUnitId ?? firstUnit?.orgUnitId ?? ""
  );
  if (rootId !== "" && !seen.has(rootId)) {
    candidates.push(rootId);
    seen.add(rootId);
  }
}

function addChildCandidates(
  units: OrgUnit[],
  candidates: string[],
  seen: Set<string>
): void {
  for (const unit of units.slice(0, 3)) {
    const childId = normalizeResource(unit.orgUnitId ?? "");
    if (childId !== "" && !seen.has(childId)) {
      candidates.push(childId);
      seen.add(childId);
    }
  }
}
