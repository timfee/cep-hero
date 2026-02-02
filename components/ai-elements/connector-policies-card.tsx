"use client";

import { memo, useMemo } from "react";

import { ConnectorStatus } from "@/components/ai-elements/connector-status";

type ResolvedPolicy = {
  policyTargetKey?: { targetResource?: string | null };
};

type ConnectorConfigOutput = {
  value?: ResolvedPolicy[];
  targetResource?: string | null;
  attemptedTargets?: string[];
  errors?: Array<{ targetResource?: string | null; message?: string }>;
  error?: string;
  suggestion?: string;
};

type ConnectorAnalysis = {
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

function analyzePolicies(policies: ResolvedPolicy[]): ConnectorAnalysis {
  const counts: ConnectorAnalysis["byTarget"] = {
    customer: 0,
    orgUnit: 0,
    group: 0,
    unknown: 0,
  };

  const misScoped: string[] = [];

  for (const policy of policies) {
    const target = policy.policyTargetKey?.targetResource ?? "";
    const normalized = target.toLowerCase();
    let bucket: keyof ConnectorAnalysis["byTarget"] = "unknown";
    if (
      normalized.startsWith("orgunits/") ||
      normalized.includes("/orgunits/")
    ) {
      bucket = "orgUnit";
    } else if (
      normalized.startsWith("groups/") ||
      normalized.includes("/groups/")
    ) {
      bucket = "group";
    } else if (
      normalized.startsWith("customers/") ||
      normalized.includes("/customers/")
    ) {
      bucket = "customer";
    }
    counts[bucket] += 1;
    if (bucket === "customer") {
      misScoped.push(target);
    }
  }

  return {
    total: policies.length,
    byTarget: counts,
    misScoped: misScoped.length,
    detail: `total=${policies.length}; customer=${counts.customer}; orgUnits=${counts.orgUnit}; groups=${counts.group}; unknown=${counts.unknown}`,
    flag: misScoped.length > 0,
    sampleTarget: misScoped[0],
  };
}

export const ConnectorPoliciesCard = memo(function ConnectorPoliciesCard({
  output,
}: {
  output: ConnectorConfigOutput;
}) {
  if (output.error) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-foreground">
        <p className="font-medium">Connector policies unavailable</p>
        <p className="text-muted-foreground">{output.error}</p>
        {output.suggestion && (
          <p className="text-muted-foreground">{output.suggestion}</p>
        )}
      </div>
    );
  }

  const policies = output.value ?? [];
  const analysis = useMemo(() => analyzePolicies(policies), [policies]);

  return (
    <div className="space-y-3">
      <ConnectorStatus analysis={analysis} />

      <div className="rounded-md border border-border bg-background">
        <div className="border-b border-border px-3 py-2">
          <p className="text-sm font-medium text-foreground">
            Connector policy targets
          </p>
          <p className="text-xs text-muted-foreground">
            Attempted targets:{" "}
            {output.attemptedTargets?.join(", ") || "unknown"}
          </p>
        </div>
        {policies.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">
            No policies were returned.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {policies.slice(0, 6).map((policy, index) => {
              const target =
                policy.policyTargetKey?.targetResource ?? "Unknown";
              return (
                <div key={`${target}-${index}`} className="px-3 py-2 text-sm">
                  <p className="font-medium text-foreground">{target}</p>
                </div>
              );
            })}
            {policies.length > 6 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                +{policies.length - 6} more policies not shown
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
