import { describe, expect, it } from "bun:test";

import { analyzeConnectorPolicies } from "@/lib/mcp/connector-analysis";

describe("analyzeConnectorPolicies", () => {
  it("flags customer-level scoped policies as mis-scoped", () => {
    const result = analyzeConnectorPolicies([
      {
        policyTargetKey: { targetResource: "customers/my_customer" },
      },
      {
        policyTargetKey: { targetResource: "orgunits/abc" },
      },
      {
        policyTargetKey: { targetResource: "customers/another" },
      },
    ] as unknown as any);

    expect(result.total).toBe(3);
    expect(result.byTarget.customer).toBe(2);
    expect(result.byTarget.orgUnit).toBe(1);
    expect(result.flag).toBe(true);
    expect(result.misScoped).toBe(2);
    expect(result.sampleTarget).toBe("customers/my_customer");
  });

  it("returns no flag when policies are OU or group scoped", () => {
    const result = analyzeConnectorPolicies([
      { policyTargetKey: { targetResource: "orgunits/root" } },
      { policyTargetKey: { targetResource: "groups/123" } },
    ] as any);

    expect(result.flag).toBe(false);
    expect(result.byTarget.customer).toBe(0);
    expect(result.byTarget.orgUnit).toBe(1);
    expect(result.byTarget.group).toBe(1);
    expect(result.detail).toContain("total=2");
  });

  it("handles empty policy lists", () => {
    const result = analyzeConnectorPolicies([]);

    expect(result.total).toBe(0);
    expect(result.flag).toBe(false);
    expect(result.byTarget.customer).toBe(0);
    expect(result.byTarget.orgUnit).toBe(0);
    expect(result.detail).toContain("total=0");
  });
});
