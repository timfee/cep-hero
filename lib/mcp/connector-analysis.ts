/**
 * Analyzer for Chrome connector policy targets to detect mis-scoping.
 */

import { type chromepolicy_v1 } from "googleapis";

/**
 * Analysis result for connector policy targets.
 */
export interface ConnectorAnalysis {
  total: number;
  byTarget: {
    customer: number;
    orgUnit: number;
    group: number;
    unknown: number;
  };
  misScoped: number;
  detail: string;
  flag: boolean;
  sampleTarget?: string;
}

type ResolvedPolicy =
  chromepolicy_v1.Schema$GoogleChromePolicyVersionsV1ResolvedPolicy & {
    policyTargetKey?: { targetResource?: string };
  };

/**
 * Classifies a policy target resource into a known scope type.
 */
function classifyTarget(
  targetResource?: string
): "customer" | "orgUnit" | "group" | "unknown" {
  if (targetResource === undefined || targetResource.length === 0) {
    return "unknown";
  }
  const normalized = targetResource.toLowerCase();
  if (normalized.startsWith("orgunits/") || normalized.includes("/orgunits/")) {
    return "orgUnit";
  }
  if (normalized.startsWith("groups/") || normalized.includes("/groups/")) {
    return "group";
  }
  if (
    normalized.startsWith("customers/") ||
    normalized.includes("/customers/")
  ) {
    return "customer";
  }
  return "unknown";
}

/**
 * Analyzes connector policy targets to detect mis-scoping.
 */
export function analyzeConnectorPolicies(
  policies: ResolvedPolicy[]
): ConnectorAnalysis {
  const mutableCounts: ConnectorAnalysis["byTarget"] = {
    customer: 0,
    orgUnit: 0,
    group: 0,
    unknown: 0,
  };
  const misScoped: chromepolicy_v1.Schema$GoogleChromePolicyVersionsV1ResolvedPolicy[] =
    [];

  for (const policy of policies) {
    const targetResource = getTargetResource(policy);
    const targetType = classifyTarget(targetResource);
    mutableCounts[targetType] += 1;
    if (targetType === "customer") {
      misScoped.push(policy);
    }
  }

  const detail = `total=${policies.length}; customer=${mutableCounts.customer}; orgUnits=${mutableCounts.orgUnit}; groups=${mutableCounts.group}; unknown=${mutableCounts.unknown}`;

  return {
    total: policies.length,
    byTarget: mutableCounts,
    misScoped: misScoped.length,
    detail,
    flag: misScoped.length > 0,
    sampleTarget:
      misScoped.length > 0 ? getTargetResource(misScoped[0]) : undefined,
  };
}

/**
 * Safely extracts the policy target resource from a resolved policy.
 */
function getTargetResource(policy: ResolvedPolicy) {
  const targetResource = policy.policyTargetKey?.targetResource;
  return typeof targetResource === "string" ? targetResource : undefined;
}
