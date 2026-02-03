import { loadEnvConfig } from "@next/env";
import { describe, expect, it, beforeAll } from "bun:test";

import {
  listOrgUnits,
  makeGoogleClients,
  probePolicyTargetResources,
} from "@/lib/test-helpers/google-admin";

loadEnvConfig(process.cwd());

const TEST_TIMEOUT_MS = 30_000;
const hasServiceAccount = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
const runIt = hasServiceAccount ? it : it.skip;

type OrgUnit = {
  orgUnitId?: string | null;
  orgUnitPath?: string | null;
  parentOrgUnitId?: string | null;
};

function normalizeOrgUnitId(orgUnitId?: string | null): string | null {
  if (!orgUnitId) {
    return null;
  }
  return orgUnitId.replace(/^id:/, "");
}

function buildTargetResources(orgUnits: OrgUnit[]): string[] {
  const [firstOu] = orgUnits;
  const rootOu = orgUnits.find((ou) => ou.orgUnitPath === "/");
  const firstId = normalizeOrgUnitId(firstOu?.orgUnitId);
  const rootId = normalizeOrgUnitId(rootOu?.orgUnitId);
  const resources = [
    firstId ? `orgunits/${firstId}` : null,
    rootId ? `orgunits/${rootId}` : null,
  ].filter((value): value is string => Boolean(value));
  return Array.from(new Set(resources));
}

function summarizeResolvedPolicies(
  results: Array<{
    targetResource?: string | null;
    resolvedPolicies: Array<{
      targetKey?: { targetResource?: string | null };
    }>;
  }>
) {
  return results.map((result) => {
    const [firstPolicy] = result.resolvedPolicies;
    return {
      targetResource: result.targetResource,
      policyCount: result.resolvedPolicies.length,
      sampleTarget: firstPolicy?.targetKey?.targetResource ?? null,
    };
  });
}

async function requireParentOrgUnitId(): Promise<string> {
  const orgUnits = await listOrgUnits();
  const [firstOu] = orgUnits;
  const parentId = normalizeOrgUnitId(firstOu?.parentOrgUnitId);
  if (!parentId) {
    throw new Error("No parent org unit ID found");
  }
  return parentId;
}

describe("Chrome Policy API targetResource behavior", () => {
  beforeAll(() => {
    if (!hasServiceAccount) {
      console.log(
        "[connector-config-api] skipping tests - no service account configured"
      );
    }
  });

  runIt(
    "lists org units to understand structure",
    async () => {
      const orgUnits = await listOrgUnits();
      console.log(
        "[connector-config-api] org units:",
        JSON.stringify(
          orgUnits.map((ou) => ({
            path: ou.orgUnitPath,
            id: ou.orgUnitId,
            parentId: ou.parentOrgUnitId,
          })),
          null,
          2
        )
      );

      expect(orgUnits.length).toBeGreaterThanOrEqual(0);
    },
    TEST_TIMEOUT_MS
  );

  runIt(
    "probes different targetResource formats",
    async () => {
      const { customerId } = await makeGoogleClients();
      const orgUnits = await listOrgUnits();

      const targetResources = buildTargetResources(orgUnits);

      console.log(
        "[connector-config-api] testing targetResources:",
        targetResources
      );
      console.log("[connector-config-api] customerId:", customerId);

      const policySchemaFilter = "chrome.users.SafeBrowsingProtectionLevel";

      const { results, errors } = await probePolicyTargetResources({
        policySchemaFilter,
        targetResources,
      });

      console.log(
        "[connector-config-api] results:",
        JSON.stringify(summarizeResolvedPolicies(results), null, 2)
      );

      console.log(
        "[connector-config-api] errors:",
        JSON.stringify(errors, null, 2)
      );

      expect(results.length + errors.length).toBe(targetResources.length);
    },
    TEST_TIMEOUT_MS
  );

  runIt(
    "verifies empty string is rejected",
    async () => {
      const { results, errors } = await probePolicyTargetResources({
        policySchemaFilter: "chrome.users.SafeBrowsingProtectionLevel",
        targetResources: [""],
      });

      console.log(
        "[connector-config-api] empty string test - results:",
        results.length
      );
      console.log(
        "[connector-config-api] empty string test - errors:",
        JSON.stringify(errors, null, 2)
      );

      expect(errors.length).toBe(1);
      expect(errors[0]?.message).toContain("orgunits");
    },
    TEST_TIMEOUT_MS
  );

  runIt(
    "verifies my_customer is rejected as org unit",
    async () => {
      const { results, errors } = await probePolicyTargetResources({
        policySchemaFilter: "chrome.users.SafeBrowsingProtectionLevel",
        targetResources: ["orgunits/my_customer"],
      });

      console.log(
        "[connector-config-api] my_customer test - results:",
        results.length
      );
      console.log(
        "[connector-config-api] my_customer test - errors:",
        JSON.stringify(errors, null, 2)
      );

      expect(errors.length).toBe(1);
      expect(errors[0]?.message).toContain("Invalid");
    },
    TEST_TIMEOUT_MS
  );

  runIt(
    "tests parent org unit ID (root)",
    async () => {
      const parentId = await requireParentOrgUnitId();

      console.log("[connector-config-api] testing parent ID:", parentId);

      const { results, errors } = await probePolicyTargetResources({
        policySchemaFilter: "chrome.users.SafeBrowsingProtectionLevel",
        targetResources: [`orgunits/${parentId}`],
      });

      console.log(
        "[connector-config-api] parent ID test - results:",
        JSON.stringify(
          results.map((r) => ({
            targetResource: r.targetResource,
            policyCount: r.resolvedPolicies.length,
          })),
          null,
          2
        )
      );
      console.log(
        "[connector-config-api] parent ID test - errors:",
        JSON.stringify(errors, null, 2)
      );

      expect(results.length).toBe(1);
      expect(errors.length).toBe(0);
    },
    TEST_TIMEOUT_MS
  );
});
