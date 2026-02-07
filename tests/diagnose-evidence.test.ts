/**
 * Unit tests for the buildEvidence function covering connector analysis and auth scope validation.
 */

import type { chromepolicy_v1 } from "googleapis";

import { describe, expect, it } from "bun:test";

import { analyzeConnectorPolicies } from "@/lib/mcp/connector-analysis";
import { CONNECTOR_POLICY_SCHEMAS } from "@/lib/mcp/constants";
import { buildEvidenceForTest } from "@/lib/test-helpers/diagnose-evidence";

type ResolvedPolicy =
  chromepolicy_v1.Schema$GoogleChromePolicyVersionsV1ResolvedPolicy;

/**
 * Build fake connector policies for tests.
 */
function makeConnectorPolicies(targets: string[]): ResolvedPolicy[] {
  return targets.map((target) => ({
    targetKey: { targetResource: target },
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
      eventsResult: { events: [], nextPageToken: null },
      dlpResult: { rules: [] },
      connectorResult: {
        status: "Resolved",
        policySchemas: CONNECTOR_POLICY_SCHEMAS,
        value: connectorPolicies,
        targetResource: "orgunits/root",
        targetResourceName: null,
        attemptedTargets: ["orgunits/root"],
      },
      connectorAnalysis,
    });

    expect(evidence.connectorAnalysis?.flag).toBe(true);
    expect(
      evidence.gaps?.some((g) => g.missing.includes("Connector policies"))
    ).toBe(true);
    const signalSummaries = evidence.signals?.map((signal) => signal.summary);
    const hasExpectedSummary =
      signalSummaries?.some((summary) =>
        ["customer level", "org units or groups"].some((snippet) =>
          summary.includes(snippet)
        )
      ) ?? false;
    expect(hasExpectedSummary).toBe(true);
  });

  it("marks pass and suggests confirmation when scoped correctly", () => {
    const connectorPolicies = makeConnectorPolicies([
      "orgunits/root",
      "groups/123",
    ]);
    const connectorAnalysis = analyzeConnectorPolicies(connectorPolicies);

    const evidence = buildEvidenceForTest({
      eventsResult: { events: [], nextPageToken: null },
      dlpResult: { rules: [] },
      connectorResult: {
        status: "Resolved",
        policySchemas: CONNECTOR_POLICY_SCHEMAS,
        value: connectorPolicies,
        targetResource: "orgunits/root",
        targetResourceName: null,
        attemptedTargets: ["orgunits/root"],
      },
      connectorAnalysis,
    });

    const connectorCheck = evidence.checks?.find(
      (c) => c.name === "Connector policies"
    );
    expect(connectorCheck?.status).toBe("pass");
    expect(evidence.connectorAnalysis?.flag).toBe(false);
  });

  it("surfaces missing required scopes when auth debug shows gaps", () => {
    const evidence = buildEvidenceForTest({
      eventsResult: { events: [], nextPageToken: null },
      dlpResult: { rules: [] },
      connectorResult: {
        status: "Resolved",
        policySchemas: CONNECTOR_POLICY_SCHEMAS,
        value: makeConnectorPolicies(["orgunits/root"]),
        targetResource: "orgunits/root",
        targetResourceName: null,
        attemptedTargets: ["orgunits/root"],
      },
      authDebugResult: {
        scopes: ["https://www.googleapis.com/auth/admin.directory.user"],
        expiresIn: 1000,
        email: undefined,
        accessType: undefined,
      },
    });

    const authCheck = evidence.checks?.find((c) => c.name === "Auth scopes");
    expect(authCheck?.status).toBe("fail");
    expect(
      evidence.gaps?.some((gap) =>
        gap.why.includes("Token lacks required scopes")
      )
    ).toBe(true);
  });

  it("records connector resolve errors as gaps", () => {
    const evidence = buildEvidenceForTest({
      eventsResult: { events: [], nextPageToken: null },
      dlpResult: { rules: [] },
      connectorResult: {
        error: "Could not determine policy target (root org unit).",
        suggestion: "Re-authenticate",
        requiresReauth: false,
        policySchemas: CONNECTOR_POLICY_SCHEMAS,
        targetResource: "orgunits/root",
        targetResourceName: null,
        attemptedTargets: ["orgunits/root"],
      },
    });

    const connectorCheck = evidence.checks?.find(
      (c) => c.name === "Connector policies"
    );
    expect(connectorCheck?.status).toBe("unknown");
    expect(
      evidence.gaps?.some((gap) => gap.missing.includes("Connector policies"))
    ).toBe(true);
  });
});
