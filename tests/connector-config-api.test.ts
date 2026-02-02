import { loadEnvConfig } from "@next/env";
import { describe, expect, it, beforeAll } from "bun:test";

import {
  listOrgUnits,
  makeGoogleClients,
  probePolicyTargetResources,
} from "@/lib/test-helpers/google-admin";

loadEnvConfig(process.cwd());

const TEST_TIMEOUT_MS = 30000;
const hasServiceAccount = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

describe("Chrome Policy API targetResource behavior", () => {
  beforeAll(() => {
    if (!hasServiceAccount) {
      console.log(
        "[connector-config-api] skipping tests - no service account configured"
      );
    }
  });

  it(
    "lists org units to understand structure",
    async () => {
      if (!hasServiceAccount) {
        expect(true).toBe(true);
        return;
      }

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

  it(
    "probes different targetResource formats",
    async () => {
      if (!hasServiceAccount) {
        expect(true).toBe(true);
        return;
      }

      const { customerId } = await makeGoogleClients();
      const orgUnits = await listOrgUnits();

      const targetResources: string[] = [];

      if (orgUnits.length > 0) {
        const firstOu = orgUnits[0];
        if (firstOu?.orgUnitId) {
          const rawId = firstOu.orgUnitId.replace(/^id:/, "");
          targetResources.push(`orgunits/${rawId}`);
        }
      }

      const rootOu = orgUnits.find((ou) => ou.orgUnitPath === "/");
      if (rootOu?.orgUnitId) {
        const rawId = rootOu.orgUnitId.replace(/^id:/, "");
        if (!targetResources.includes(`orgunits/${rawId}`)) {
          targetResources.push(`orgunits/${rawId}`);
        }
      }

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
        JSON.stringify(
          results.map((r) => ({
            targetResource: r.targetResource,
            policyCount: r.resolvedPolicies.length,
            sampleTarget:
              r.resolvedPolicies[0]?.targetKey?.targetResource ?? null,
          })),
          null,
          2
        )
      );

      console.log(
        "[connector-config-api] errors:",
        JSON.stringify(errors, null, 2)
      );

      expect(results.length + errors.length).toBe(targetResources.length);
    },
    TEST_TIMEOUT_MS
  );

  it(
    "verifies empty string is rejected",
    async () => {
      if (!hasServiceAccount) {
        expect(true).toBe(true);
        return;
      }

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

  it(
    "verifies my_customer is rejected as org unit",
    async () => {
      if (!hasServiceAccount) {
        expect(true).toBe(true);
        return;
      }

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

  it(
    "tests parent org unit ID (root)",
    async () => {
      if (!hasServiceAccount) {
        expect(true).toBe(true);
        return;
      }

      const orgUnits = await listOrgUnits();
      const firstOu = orgUnits[0];
      const parentId = firstOu?.parentOrgUnitId?.replace(/^id:/, "");

      if (!parentId) {
        console.log("[connector-config-api] no parent org unit ID found");
        expect(true).toBe(true);
        return;
      }

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
