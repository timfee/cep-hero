import { describe, expect, it } from "bun:test";

import { analyzeConnectorPolicies } from "@/lib/mcp/connector-analysis";
import { buildEvidenceForTest } from "@/lib/test-helpers/diagnose-evidence";

function makeConnectorPolicies(targets: string[]) {
  return targets.map((target) => ({ policyTargetKey: { targetResource: target } }));
}

describe("buildEvidence connector handling", () => {
  it("adds next steps and gap when connector policies are customer-scoped", () => {
    const connectorPolicies = makeConnectorPolicies([
      "customers/my_customer",
      "orgunits/abc",
    ]);
    const connectorAnalysis = analyzeConnectorPolicies(connectorPolicies as any);

    const evidence = buildEvidenceForTest({
      eventsResult: { events: [] },
      dlpResult: { rules: [] },
      connectorResult: { value: connectorPolicies },
      connectorAnalysis,
    });

    expect(evidence.connectorAnalysis?.flag).toBe(true);
    expect(evidence.gaps?.some((g) => g.missing.includes("Connector policies"))).toBe(true);
    expect(
      evidence.signals?.some((s) =>
        s.summary.includes("customer level") || s.summary.includes("org units or groups")
      )
    ).toBe(true);
  });

  it("marks pass and suggests confirmation when scoped correctly", () => {
    const connectorPolicies = makeConnectorPolicies(["orgunits/root", "groups/123"]);
    const connectorAnalysis = analyzeConnectorPolicies(connectorPolicies as any);

    const evidence = buildEvidenceForTest({
      eventsResult: { events: [] },
      dlpResult: { rules: [] },
      connectorResult: { value: connectorPolicies },
      connectorAnalysis,
    });

    const connectorCheck = evidence.checks?.find((c) => c.name === "Connector policies");
    expect(connectorCheck?.status).toBe("pass");
    expect(evidence.connectorAnalysis?.flag).toBe(false);
  });
});
