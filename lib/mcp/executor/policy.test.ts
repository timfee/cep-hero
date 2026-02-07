/**
 * Unit tests for Chrome Policy API operations.
 * Validates that applyPolicyChange sends correctly structured payloads
 * to the Chrome Policy batchModify API, and that draftPolicyChange
 * returns the correct proposal structure.
 */

import { describe, expect, it, mock } from "bun:test";
import { OAuth2Client } from "google-auth-library";
import { google as googleApis } from "googleapis";

import { type OrgUnitContext } from "./context";
import { applyPolicyChange, draftPolicyChange } from "./policy";

/**
 * Builds a mock OrgUnitContext for testing.
 */
function buildOrgUnitContext(): OrgUnitContext {
  const orgUnitNameMap = new Map<string, string>();
  orgUnitNameMap.set("03ph8a2z221pcso", "/Engineering");
  orgUnitNameMap.set("orgunits/03ph8a2z221pcso", "/Engineering");

  return {
    orgUnitList: [],
    orgUnitNameMap,
    rootOrgUnitId: "id:03ph8a2z23yjui6",
    rootOrgUnitPath: "/",
  };
}

/**
 * Captured batchModify arguments for assertions.
 */
interface CapturedBatchModify {
  customer: string;
  requestBody: {
    requests: {
      policyTargetKey: { targetResource: string };
      policyValue: {
        policySchema: string;
        value: Record<string, unknown>;
      };
      updateMask: string;
    }[];
  };
}

/**
 * Builds a mock chromepolicy service that captures batchModify calls.
 */
function buildMockChromepolicy(captured: CapturedBatchModify[]) {
  const mockBatchModify = mock((args: CapturedBatchModify) => {
    captured.push(args);
    return Promise.resolve({ status: 200, data: {} });
  });

  return mock(() => ({
    customers: {
      policies: {
        orgunits: {
          batchModify: mockBatchModify,
        },
      },
    },
  }));
}

describe("draftPolicyChange", () => {
  const ctx = buildOrgUnitContext();

  it("returns a ui.confirmation response", () => {
    const result = draftPolicyChange(ctx, {
      policyName: "Incognito Mode Availability",
      policySchemaId: "chrome.users.IncognitoModeAvailability",
      proposedValue: { incognitoModeAvailability: 1 },
      targetUnit: "id:03ph8a2z221pcso",
      reasoning: "Disable incognito mode for security compliance",
    });

    expect(result._type).toBe("ui.confirmation");
    expect(result.status).toBe("pending_approval");
    expect(result.intent).toBe("update_policy");
  });

  it("includes applyParams with schema ID for downstream apply call", () => {
    const result = draftPolicyChange(ctx, {
      policyName: "Incognito Mode Availability",
      policySchemaId: "chrome.users.IncognitoModeAvailability",
      proposedValue: { incognitoModeAvailability: 1 },
      targetUnit: "id:03ph8a2z221pcso",
      reasoning: "Compliance requirement",
    });

    expect(result.applyParams).toBeDefined();
    expect(result.applyParams.policySchemaId).toBe(
      "chrome.users.IncognitoModeAvailability"
    );
    expect(result.applyParams.targetResource).toBe("id:03ph8a2z221pcso");
    expect(result.applyParams.value).toEqual({ incognitoModeAvailability: 1 });
  });

  it("resolves org unit to display path", () => {
    const result = draftPolicyChange(ctx, {
      policyName: "Password Manager",
      policySchemaId: "chrome.users.PasswordManager",
      proposedValue: { passwordManagerEnabled: false },
      targetUnit: "id:03ph8a2z221pcso",
      reasoning: "Disable password manager",
    });

    expect(result.target).toBe("/Engineering");
  });

  it("falls back to raw targetUnit when not in name map", () => {
    const result = draftPolicyChange(ctx, {
      policyName: "Password Manager",
      policySchemaId: "chrome.users.PasswordManager",
      proposedValue: { passwordManagerEnabled: false },
      targetUnit: "id:unknown-org-unit",
      reasoning: "Test unknown org unit",
    });

    expect(result.target).toBe("id:unknown-org-unit");
  });

  it("uses provided adminConsoleUrl", () => {
    const result = draftPolicyChange(ctx, {
      policyName: "Incognito Mode Availability",
      policySchemaId: "chrome.users.IncognitoModeAvailability",
      proposedValue: { incognitoModeAvailability: 1 },
      targetUnit: "id:03ph8a2z221pcso",
      reasoning: "Test",
      adminConsoleUrl: "https://admin.google.com/ac/chrome/users",
    });

    expect(result.adminConsoleUrl).toBe(
      "https://admin.google.com/ac/chrome/users"
    );
  });

  it("defaults adminConsoleUrl to settings page", () => {
    const result = draftPolicyChange(ctx, {
      policyName: "Incognito Mode Availability",
      policySchemaId: "chrome.users.IncognitoModeAvailability",
      proposedValue: { incognitoModeAvailability: 1 },
      targetUnit: "id:03ph8a2z221pcso",
      reasoning: "Test",
    });

    expect(result.adminConsoleUrl).toBe(
      "https://admin.google.com/ac/chrome/settings"
    );
  });

  it("resolves '/' targetUnit to root org unit ID in applyParams", () => {
    const result = draftPolicyChange(ctx, {
      policyName: "Safe Browsing",
      policySchemaId: "chrome.users.SafeBrowsing",
      proposedValue: { safeBrowsingEnabled: true },
      targetUnit: "/",
      reasoning: "Enable at root",
    });

    expect(result.applyParams.targetResource).toBe("orgunits/03ph8a2z23yjui6");
    expect(result.applyParams.targetResource).not.toBe("/");
  });

  it("resolves path-based targetUnit to org unit ID in applyParams", () => {
    const result = draftPolicyChange(ctx, {
      policyName: "Safe Browsing",
      policySchemaId: "chrome.users.SafeBrowsing",
      proposedValue: { safeBrowsingEnabled: true },
      targetUnit: "/Engineering",
      reasoning: "Enable for engineering",
    });

    expect(result.applyParams.targetResource).toBe("orgunits/03ph8a2z221pcso");
    expect(result.applyParams.targetResource).not.toStartWith("/");
  });

  it("generates unique proposal IDs", () => {
    const result1 = draftPolicyChange(ctx, {
      policyName: "Password Manager",
      policySchemaId: "chrome.users.PasswordManager",
      proposedValue: {},
      targetUnit: "id:03ph8a2z221pcso",
      reasoning: "Test 1",
    });
    const result2 = draftPolicyChange(ctx, {
      policyName: "Password Manager",
      policySchemaId: "chrome.users.PasswordManager",
      proposedValue: {},
      targetUnit: "id:03ph8a2z221pcso",
      reasoning: "Test 2",
    });

    expect(result1.proposalId).not.toBe(result2.proposalId);
    expect(result1.proposalId).toStartWith("proposal-");
    expect(result2.proposalId).toStartWith("proposal-");
  });
});

describe("draft → apply round-trip", () => {
  const ctx = buildOrgUnitContext();
  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: "test-token" });
  const customerId = "my_customer";

  it("draft with '/' targetUnit round-trips successfully through apply", async () => {
    const captured: CapturedBatchModify[] = [];
    const mockCP = buildMockChromepolicy(captured);
    const original = googleApis.chromepolicy;
    googleApis.chromepolicy =
      mockCP as unknown as typeof googleApis.chromepolicy;

    try {
      const draft = draftPolicyChange(ctx, {
        policyName: "Incognito Mode Availability",
        policySchemaId: "chrome.users.IncognitoModeAvailability",
        proposedValue: { incognitoModeAvailability: 1 },
        targetUnit: "/",
        reasoning: "Disable incognito at root",
      });

      expect(draft.applyParams.targetResource).not.toBe("/");
      expect(draft.applyParams.targetResource).not.toBe("");

      const result = await applyPolicyChange(auth, customerId, {
        policySchemaId: draft.applyParams.policySchemaId,
        targetResource: draft.applyParams.targetResource,
        value: draft.applyParams.value,
      });

      expect(result._type).toBe("ui.success");
      expect(captured).toHaveLength(1);
      expect(
        captured[0].requestBody.requests[0].policyTargetKey.targetResource
      ).toStartWith("orgunits/");
    } finally {
      googleApis.chromepolicy = original;
    }
  });

  it("draft with path-based targetUnit round-trips successfully through apply", async () => {
    const captured: CapturedBatchModify[] = [];
    const mockCP = buildMockChromepolicy(captured);
    const original = googleApis.chromepolicy;
    googleApis.chromepolicy =
      mockCP as unknown as typeof googleApis.chromepolicy;

    try {
      const draft = draftPolicyChange(ctx, {
        policyName: "Password Manager",
        policySchemaId: "chrome.users.PasswordManager",
        proposedValue: { passwordManagerEnabled: false },
        targetUnit: "/Engineering",
        reasoning: "Disable for eng",
      });

      expect(draft.applyParams.targetResource).toBe("orgunits/03ph8a2z221pcso");

      const result = await applyPolicyChange(auth, customerId, {
        policySchemaId: draft.applyParams.policySchemaId,
        targetResource: draft.applyParams.targetResource,
        value: draft.applyParams.value,
      });

      expect(result._type).toBe("ui.success");
    } finally {
      googleApis.chromepolicy = original;
    }
  });

  it("applyParams.policySchemaId is the schema ID, not the human name", () => {
    const result = draftPolicyChange(ctx, {
      policyName: "On Security Event Enterprise Connector",
      policySchemaId: "chrome.users.EnterpriseConnectors.OnSecurityEvent",
      proposedValue: [{ service_provider: "google" }],
      targetUnit: "id:03ph8a2z221pcso",
      reasoning: "Enable security event reporting",
    });

    expect(result.applyParams.policySchemaId).toBe(
      "chrome.users.EnterpriseConnectors.OnSecurityEvent"
    );
    expect(result.applyParams.policySchemaId).not.toBe(
      "On Security Event Enterprise Connector"
    );
  });

  it("draft output feeds directly into apply for connector policies", async () => {
    const captured: CapturedBatchModify[] = [];
    const mockCP = buildMockChromepolicy(captured);
    const original = googleApis.chromepolicy;
    googleApis.chromepolicy =
      mockCP as unknown as typeof googleApis.chromepolicy;

    try {
      const draft = draftPolicyChange(ctx, {
        policyName: "On Security Event Enterprise Connector",
        policySchemaId: "chrome.users.EnterpriseConnectors.OnSecurityEvent",
        proposedValue: [{ service_provider: "google" }],
        targetUnit: "id:03ph8a2z221pcso",
        reasoning: "Enable security event reporting",
      });

      const result = await applyPolicyChange(auth, customerId, {
        policySchemaId: draft.applyParams.policySchemaId,
        targetResource: draft.applyParams.targetResource,
        value: draft.applyParams.value,
      });

      expect(result._type).toBe("ui.success");
      expect(captured).toHaveLength(1);
      expect(captured[0].requestBody.requests[0].updateMask).toBe(
        "onSecurityEventEnterpriseConnector"
      );
    } finally {
      googleApis.chromepolicy = original;
    }
  });

  it("draft output feeds directly into apply for simple policies", async () => {
    const captured: CapturedBatchModify[] = [];
    const mockCP = buildMockChromepolicy(captured);
    const original = googleApis.chromepolicy;
    googleApis.chromepolicy =
      mockCP as unknown as typeof googleApis.chromepolicy;

    try {
      const draft = draftPolicyChange(ctx, {
        policyName: "Incognito Mode Availability",
        policySchemaId: "chrome.users.IncognitoModeAvailability",
        proposedValue: { incognitoModeAvailability: 1 },
        targetUnit: "id:03ph8a2z221pcso",
        reasoning: "Disable incognito",
      });

      const result = await applyPolicyChange(auth, customerId, {
        policySchemaId: draft.applyParams.policySchemaId,
        targetResource: draft.applyParams.targetResource,
        value: draft.applyParams.value,
      });

      expect(result._type).toBe("ui.success");
      expect(captured[0].requestBody.requests[0].policyValue.policySchema).toBe(
        "chrome.users.IncognitoModeAvailability"
      );
    } finally {
      googleApis.chromepolicy = original;
    }
  });

  for (const [schemaId, valueKey] of Object.entries({
    "chrome.users.EnterpriseConnectors.OnFileAttached":
      "onFileAttachedEnterpriseConnector",
    "chrome.users.EnterpriseConnectors.OnFileDownloaded":
      "onFileDownloadedEnterpriseConnector",
    "chrome.users.EnterpriseConnectors.OnBulkDataEntry":
      "onBulkDataEntryEnterpriseConnector",
    "chrome.users.EnterpriseConnectors.OnSecurityEvent":
      "onSecurityEventEnterpriseConnector",
    "chrome.users.EnterpriseConnectors.OnPrint": "onPrintEnterpriseConnector",
  })) {
    it(`round-trips ${schemaId} through draft → apply`, async () => {
      const captured: CapturedBatchModify[] = [];
      const mockCP = buildMockChromepolicy(captured);
      const original = googleApis.chromepolicy;
      googleApis.chromepolicy =
        mockCP as unknown as typeof googleApis.chromepolicy;

      try {
        const draft = draftPolicyChange(ctx, {
          policyName: `Human Name for ${schemaId.split(".").pop()}`,
          policySchemaId: schemaId,
          proposedValue: [{ service_provider: "google" }],
          targetUnit: "id:03ph8a2z221pcso",
          reasoning: "Test round-trip",
        });

        const result = await applyPolicyChange(auth, customerId, {
          policySchemaId: draft.applyParams.policySchemaId,
          targetResource: draft.applyParams.targetResource,
          value: draft.applyParams.value,
        });

        expect(result._type).toBe("ui.success");
        expect(captured[0].requestBody.requests[0].updateMask).toBe(valueKey);
      } finally {
        googleApis.chromepolicy = original;
      }
    });
  }
});

describe("applyPolicyChange payload validation", () => {
  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: "test-token" });
  const customerId = "my_customer";

  it("uses customers/ prefix for customer field", async () => {
    const captured: CapturedBatchModify[] = [];
    const mockCP = buildMockChromepolicy(captured);
    const original = googleApis.chromepolicy;
    googleApis.chromepolicy =
      mockCP as unknown as typeof googleApis.chromepolicy;

    try {
      await applyPolicyChange(auth, customerId, {
        policySchemaId: "chrome.users.IncognitoModeAvailability",
        targetResource: "orgunits/03ph8a2z221pcso",
        value: { incognitoModeAvailability: 1 },
      });

      expect(captured).toHaveLength(1);
      expect(captured[0].customer).toBe("customers/my_customer");
    } finally {
      googleApis.chromepolicy = original;
    }
  });

  it("uses orgunits/ prefix for targetResource", async () => {
    const captured: CapturedBatchModify[] = [];
    const mockCP = buildMockChromepolicy(captured);
    const original = googleApis.chromepolicy;
    googleApis.chromepolicy =
      mockCP as unknown as typeof googleApis.chromepolicy;

    try {
      await applyPolicyChange(auth, customerId, {
        policySchemaId: "chrome.users.IncognitoModeAvailability",
        targetResource: "id:03ph8a2z221pcso",
        value: { incognitoModeAvailability: 1 },
      });

      const request = captured[0].requestBody.requests[0];
      expect(request.policyTargetKey.targetResource).toStartWith("orgunits/");
      expect(request.policyTargetKey.targetResource).not.toContain(
        "customers/"
      );
    } finally {
      googleApis.chromepolicy = original;
    }
  });

  it("passes policySchema and value correctly", async () => {
    const captured: CapturedBatchModify[] = [];
    const mockCP = buildMockChromepolicy(captured);
    const original = googleApis.chromepolicy;
    googleApis.chromepolicy =
      mockCP as unknown as typeof googleApis.chromepolicy;

    try {
      await applyPolicyChange(auth, customerId, {
        policySchemaId: "chrome.users.PasswordManager",
        targetResource: "orgunits/03ph8a2z221pcso",
        value: { passwordManagerEnabled: false },
      });

      const request = captured[0].requestBody.requests[0];
      expect(request.policyValue.policySchema).toBe(
        "chrome.users.PasswordManager"
      );
      expect(request.policyValue.value).toEqual({
        passwordManagerEnabled: false,
      });
    } finally {
      googleApis.chromepolicy = original;
    }
  });

  it("builds updateMask from value keys", async () => {
    const captured: CapturedBatchModify[] = [];
    const mockCP = buildMockChromepolicy(captured);
    const original = googleApis.chromepolicy;
    googleApis.chromepolicy =
      mockCP as unknown as typeof googleApis.chromepolicy;

    try {
      await applyPolicyChange(auth, customerId, {
        policySchemaId: "chrome.users.IncognitoModeAvailability",
        targetResource: "orgunits/03ph8a2z221pcso",
        value: { incognitoModeAvailability: 1 },
      });

      const request = captured[0].requestBody.requests[0];
      expect(request.updateMask).toBe("incognitoModeAvailability");
    } finally {
      googleApis.chromepolicy = original;
    }
  });

  it("builds updateMask with multiple keys", async () => {
    const captured: CapturedBatchModify[] = [];
    const mockCP = buildMockChromepolicy(captured);
    const original = googleApis.chromepolicy;
    googleApis.chromepolicy =
      mockCP as unknown as typeof googleApis.chromepolicy;

    try {
      await applyPolicyChange(auth, customerId, {
        policySchemaId: "chrome.users.PasswordManager",
        targetResource: "orgunits/03ph8a2z221pcso",
        value: {
          passwordManagerEnabled: false,
          passwordLeakDetectionEnabled: true,
        },
      });

      const request = captured[0].requestBody.requests[0];
      expect(request.updateMask).toBe(
        "passwordManagerEnabled,passwordLeakDetectionEnabled"
      );
    } finally {
      googleApis.chromepolicy = original;
    }
  });

  it("returns ui.success on successful API response", async () => {
    const captured: CapturedBatchModify[] = [];
    const mockCP = buildMockChromepolicy(captured);
    const original = googleApis.chromepolicy;
    googleApis.chromepolicy =
      mockCP as unknown as typeof googleApis.chromepolicy;

    try {
      const result = await applyPolicyChange(auth, customerId, {
        policySchemaId: "chrome.users.IncognitoModeAvailability",
        targetResource: "orgunits/03ph8a2z221pcso",
        value: { incognitoModeAvailability: 1 },
      });

      expect(result._type).toBe("ui.success");
      if (result._type === "ui.success") {
        expect(result.policySchemaId).toBe(
          "chrome.users.IncognitoModeAvailability"
        );
        expect(result.appliedValue).toEqual({ incognitoModeAvailability: 1 });
      }
    } finally {
      googleApis.chromepolicy = original;
    }
  });

  it("returns ui.error when targetResource resolves to empty", async () => {
    const result = await applyPolicyChange(auth, customerId, {
      policySchemaId: "chrome.users.IncognitoModeAvailability",
      targetResource: "customers/my_customer",
      value: { incognitoModeAvailability: 1 },
    });

    expect(result._type).toBe("ui.error");
    if (result._type === "ui.error") {
      expect(result.error).toContain(
        "Org Unit ID is required. Cannot target a customer directly."
      );
    }
  });

  it("wraps array values into a record keyed by the connector field name", async () => {
    const captured: CapturedBatchModify[] = [];
    const mockCP = buildMockChromepolicy(captured);
    const original = googleApis.chromepolicy;
    googleApis.chromepolicy =
      mockCP as unknown as typeof googleApis.chromepolicy;

    try {
      const result = await applyPolicyChange(auth, customerId, {
        policySchemaId: "chrome.users.EnterpriseConnectors.OnFileAttached",
        targetResource: "orgunits/03ph8a2z221pcso",
        value: [
          {
            block_until_verdict: 1,
            service_provider: "google",
            enable: [{ tags: ["dlp", "malware"], url_list: ["*"] }],
          },
        ],
      });

      expect(result._type).toBe("ui.success");
      const request = captured[0].requestBody.requests[0];
      expect(request.policyValue.value).toEqual({
        onFileAttachedEnterpriseConnector: [
          {
            block_until_verdict: 1,
            service_provider: "google",
            enable: [{ tags: ["dlp", "malware"], url_list: ["*"] }],
          },
        ],
      });
      expect(request.updateMask).toBe("onFileAttachedEnterpriseConnector");
    } finally {
      googleApis.chromepolicy = original;
    }
  });

  it("rejects array values for non-EnterpriseConnectors policies", async () => {
    const result = await applyPolicyChange(auth, customerId, {
      policySchemaId: "chrome.users.IncognitoModeAvailability",
      targetResource: "orgunits/03ph8a2z221pcso",
      value: [{ incognitoModeAvailability: 1 }],
    });

    expect(result._type).toBe("ui.error");
    if (result._type === "ui.error") {
      expect(result.error).toContain("EnterpriseConnectors");
    }
  });

  it("returns ui.error on API exception", async () => {
    const mockCP = mock(() => ({
      customers: {
        policies: {
          orgunits: {
            batchModify: mock(() => {
              return Promise.reject(new Error("API quota exceeded"));
            }),
          },
        },
      },
    }));
    const original = googleApis.chromepolicy;
    googleApis.chromepolicy =
      mockCP as unknown as typeof googleApis.chromepolicy;

    try {
      const result = await applyPolicyChange(auth, customerId, {
        policySchemaId: "chrome.users.IncognitoModeAvailability",
        targetResource: "orgunits/03ph8a2z221pcso",
        value: { incognitoModeAvailability: 1 },
      });

      expect(result._type).toBe("ui.error");
      if (result._type === "ui.error") {
        expect(result.error).toBe("API quota exceeded");
        expect(result.suggestion).toBeDefined();
      }
    } finally {
      googleApis.chromepolicy = original;
    }
  });
});
