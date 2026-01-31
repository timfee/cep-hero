import type { chromepolicy_v1 } from "googleapis";

export type ConnectorAnalysis = {
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
};

function classifyTarget(targetResource?: string): "customer" | "orgUnit" | "group" | "unknown" {
  if (!targetResource) return "unknown";
  const normalized = targetResource.toLowerCase();
  if (normalized.startsWith("orgunits/") || normalized.includes("/orgunits/")) return "orgUnit";
  if (normalized.startsWith("groups/") || normalized.includes("/groups/")) return "group";
  if (normalized.startsWith("customers/") || normalized.includes("/customers/")) return "customer";
  return "unknown";
}

export function analyzeConnectorPolicies(
  policies: chromepolicy_v1.Schema$GoogleChromePolicyVersionsV1ResolvedPolicy[]
): ConnectorAnalysis {
  const mutableCounts: ConnectorAnalysis["byTarget"] = {
    customer: 0,
    orgUnit: 0,
    group: 0,
    unknown: 0,
  };
  const misScoped: chromepolicy_v1.Schema$GoogleChromePolicyVersionsV1ResolvedPolicy[] = [];

  for (const policy of policies) {
    const targetResource = policy.policyTargetKey?.targetResource;
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
    sampleTarget: misScoped[0]?.policyTargetKey?.targetResource,
  };
}
