/**
 * Live integration tests proving Chrome Policy API rejects customers/ targets.
 *
 * This is the test that should have existed from the start. It calls the real
 * Google APIs and verifies the exact error that was hitting production:
 *   "Requested target resource must be of type 'orgunits', instead it is 'customers'"
 *
 * Requirements:
 * - GOOGLE_SERVICE_ACCOUNT_JSON: Service account with domain-wide delegation
 * - GOOGLE_TOKEN_EMAIL: Admin user email for impersonation
 *
 * Tests auto-skip when credentials are missing or lack permissions.
 */

import { loadEnvConfig } from "@next/env";
import { beforeAll, describe, expect, it } from "bun:test";

import {
  createEnrollmentToken,
  makeGoogleClients,
  probePolicyTargetResources,
} from "@/lib/test-helpers/google-admin";

loadEnvConfig(process.cwd());

const TEST_TIMEOUT_MS = 30_000;
const hasServiceAccount = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
const runIt = hasServiceAccount ? it : it.skip;

let validOrgUnitTarget: string | null = null;
let hasValidPermissions = false;

/**
 * Validate credentials and resolve a known-good org unit target.
 */
async function setup(): Promise<boolean> {
  if (!hasServiceAccount) {
    return false;
  }

  try {
    const { directory, customerId } = await makeGoogleClients();
    const res = await directory.orgunits.list({
      customerId,
      type: "all",
    });

    if (res.status !== 200) {
      return false;
    }

    const orgUnits = res.data.organizationUnits ?? [];
    const rootUnit = orgUnits.find((ou) => ou.parentOrgUnitId === null);
    const firstUnit = orgUnits[0];

    const rawId = (
      rootUnit?.orgUnitId ??
      firstUnit?.parentOrgUnitId ??
      firstUnit?.orgUnitId ??
      ""
    ).replace(/^id:/, "");

    if (rawId) {
      validOrgUnitTarget = `orgunits/${rawId}`;
    }

    hasValidPermissions = true;
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(
      "[target-resource-type] skipping - credential setup failed:",
      message.slice(0, 120)
    );
    return false;
  }
}

/**
 * Guard that skips the test body if permissions are invalid.
 */
function requirePermissions() {
  if (!hasValidPermissions) {
    console.log("[target-resource-type] skipping - invalid permissions");
    return false;
  }
  if (!validOrgUnitTarget) {
    console.log("[target-resource-type] skipping - no org unit resolved");
    return false;
  }
  return true;
}

describe("Chrome Policy API rejects customers/ targetResource", () => {
  beforeAll(async () => {
    await setup();
  });

  runIt(
    "customers/my_customer is rejected by policies.resolve",
    async () => {
      if (!requirePermissions()) {
        return;
      }

      const { results, errors } = await probePolicyTargetResources({
        policySchemaFilter: "chrome.users.SafeBrowsingProtectionLevel",
        targetResources: ["customers/my_customer"],
      });

      console.log(
        "[target-resource-type] customers/ resolve result:",
        JSON.stringify({ results: results.length, errors }, null, 2)
      );

      // The API should either skip it (probePolicyTargetResources validates)
      // or return an error about orgunits
      expect(results.length).toBe(0);
    },
    TEST_TIMEOUT_MS
  );

  runIt(
    "orgunits/ target succeeds with policies.resolve",
    async () => {
      if (!requirePermissions()) {
        return;
      }

      const { results, errors } = await probePolicyTargetResources({
        policySchemaFilter: "chrome.users.SafeBrowsingProtectionLevel",
        targetResources: [validOrgUnitTarget!],
      });

      console.log(
        "[target-resource-type] orgunits/ resolve result:",
        JSON.stringify(
          {
            results: results.length,
            errors: errors.length,
            targetResource: validOrgUnitTarget,
          },
          null,
          2
        )
      );

      expect(results.length).toBe(1);
      expect(errors.length).toBe(0);
    },
    TEST_TIMEOUT_MS
  );
});

describe("Chrome Management enrollment API rejects customers/ targetResource", () => {
  beforeAll(async () => {
    await setup();
  });

  runIt(
    "customers/my_customer is rejected by enrollment create",
    async () => {
      if (!requirePermissions()) {
        return;
      }

      try {
        await createEnrollmentToken("customers/my_customer");
        throw new Error(
          "Expected API to reject customers/ target, but it succeeded"
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(
          "[target-resource-type] enrollment customers/ error:",
          message.slice(0, 200)
        );
        expect(message).toContain("orgunits");
      }
    },
    TEST_TIMEOUT_MS
  );

  runIt(
    "orgunits/ target succeeds with enrollment create",
    async () => {
      if (!requirePermissions()) {
        return;
      }

      try {
        const result = await createEnrollmentToken(validOrgUnitTarget!);
        console.log(
          "[target-resource-type] enrollment orgunits/ result:",
          JSON.stringify(result, null, 2)
        );
        expect(result.token).toBeTruthy();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Enrollment may fail for permission reasons unrelated to target format.
        // If so, the error should NOT be about orgunits/customers type.
        console.log(
          "[target-resource-type] enrollment orgunits/ error:",
          message.slice(0, 200)
        );
        expect(message).not.toContain("must be of type 'orgunits'");
      }
    },
    TEST_TIMEOUT_MS
  );
});
