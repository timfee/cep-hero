import type { chromepolicy_v1 } from "googleapis";

import { describe, expect, it } from "bun:test";

import { analyzeConnectorPolicies } from "@/lib/mcp/connector-analysis";
import { buildEvidenceForTest } from "@/lib/test-helpers/diagnose-evidence";

type ResolvedPolicy =
  chromepolicy_v1.Schema$GoogleChromePolicyVersionsV1ResolvedPolicy & {
    policyTargetKey?: { targetResource?: string };
  };

/**
 * Build fake connector policies for tests.
 */
function makeConnectorPolicies(targets: string[]): ResolvedPolicy[] {
  return targets.map((target) => ({
    policyTargetKey: { targetResource: target },
  }));
}

describe("buildEvidence connector handling", () => {
  it("adds next steps and gap when connector policies are customer-scoped", () => {
    const connectorPolicies = makeConnectorPolicies([
      "customers/my_customer",
      "orgunits/abc",
    ]);
    const connectorAnalysis = analyzeConnectorPolicies(connectorPolicies);

    const evidence = buildEvidenceForTest({
      eventsResult: { events: [] },
      dlpResult: { rules: [] },
      connectorResult: {
        status: "Resolved",
        policySchemas: [],
        value: connectorPolicies,
        targetResource: "orgunits/root",
      },
      connectorAnalysis,
    });

    expect(evidence.connectorAnalysis?.flag).toBe(true);
    expect(
      evidence.gaps?.some((g) => g.missing.includes("Connector policies"))
    ).toBe(true);
    expect(
      evidence.signals?.some(
        (s) =>
          s.summary.includes("customer level") ||
          s.summary.includes("org units or groups")
      )
    ).toBe(true);
  });

  it("marks pass and suggests confirmation when scoped correctly", () => {
    const connectorPolicies = makeConnectorPolicies([
      "orgunits/root",
      "groups/123",
    ]);
    const connectorAnalysis = analyzeConnectorPolicies(connectorPolicies);

    const evidence = buildEvidenceForTest({
      eventsResult: { events: [] },
      dlpResult: { rules: [] },
      connectorResult: {
        status: "Resolved",
        policySchemas: [],
        value: connectorPolicies,
        targetResource: "orgunits/root",
      },
      connectorAnalysis,
    });

    const connectorCheck = evidence.checks?.find(
      (c) => c.name === "Connector policies"
    );
    expect(connectorCheck?.status).toBe("pass");
    expect(evidence.connectorAnalysis?.flag).toBe(false);
  });
});
