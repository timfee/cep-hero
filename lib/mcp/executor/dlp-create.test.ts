/**
 * Unit tests for DLP rule creation payload validation.
 * Validates that createDLPRule sends correctly structured payloads to the
 * Cloud Identity v1beta1 API and handles error cases appropriately.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { OAuth2Client } from "google-auth-library";

import { type OrgUnitContext } from "./context";
import { createDLPRule } from "./dlp-create";

/**
 * Builds a mock OrgUnitContext for testing.
 */
function buildOrgUnitContext(): OrgUnitContext {
  const orgUnitNameMap = new Map<string, string>();
  orgUnitNameMap.set("03ph8a2z221pcso", "/Engineering");
  orgUnitNameMap.set("orgunits/03ph8a2z221pcso", "/Engineering");
  orgUnitNameMap.set("03ph8a2z23yjui6", "/");
  orgUnitNameMap.set("orgunits/03ph8a2z23yjui6", "/");

  return {
    orgUnitList: [],
    orgUnitNameMap,
    rootOrgUnitId: "id:03ph8a2z23yjui6",
    rootOrgUnitPath: "/",
  };
}

/**
 * Captured fetch request for assertions.
 */
interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

describe("createDLPRule payload validation", () => {
  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: "test-token-abc" });
  const ctx = buildOrgUnitContext();
  const customerId = "C046psxkn";

  let originalFetch: typeof globalThis.fetch;
  let capturedRequests: CapturedRequest[];

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    capturedRequests = [];
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  /**
   * Installs a mock fetch that captures requests and returns a success response.
   */
  function mockFetchSuccess(ruleName = "policies/dlp-rule-123") {
    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit
    ) => {
      capturedRequests.push({
        url: String(url),
        method: init?.method ?? "GET",
        headers: Object.fromEntries(
          Object.entries(init?.headers ?? {}).map(([k, v]) => [k, String(v)])
        ),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });

      return new Response(JSON.stringify({ name: ruleName }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof globalThis.fetch;
  }

  /**
   * Installs a mock fetch that returns an API error.
   */
  function mockFetchError(status: number, errorMessage: string) {
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({ error: { message: errorMessage } }),
        { status, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof globalThis.fetch;
  }

  it("sends POST to Cloud Identity v1beta1 policies endpoint", async () => {
    mockFetchSuccess();

    await createDLPRule(auth, customerId, ctx, {
      displayName: "Block uploads",
      targetOrgUnit: "id:03ph8a2z221pcso",
      triggers: ["UPLOAD"],
      action: "BLOCK",
    });

    expect(capturedRequests).toHaveLength(1);
    expect(capturedRequests[0].url).toBe(
      "https://cloudidentity.googleapis.com/v1beta1/policies"
    );
    expect(capturedRequests[0].method).toBe("POST");
  });

  it("sets correct Authorization header", async () => {
    mockFetchSuccess();

    await createDLPRule(auth, customerId, ctx, {
      displayName: "Audit downloads",
      targetOrgUnit: "id:03ph8a2z221pcso",
      triggers: ["DOWNLOAD"],
      action: "AUDIT",
    });

    expect(capturedRequests[0].headers.Authorization).toBe(
      "Bearer test-token-abc"
    );
    expect(capturedRequests[0].headers["Content-Type"]).toBe(
      "application/json"
    );
  });

  it("uses customers/ prefix for customer field", async () => {
    mockFetchSuccess();

    await createDLPRule(auth, customerId, ctx, {
      displayName: "Test rule",
      targetOrgUnit: "id:03ph8a2z221pcso",
      triggers: ["UPLOAD"],
      action: "AUDIT",
    });

    const body = capturedRequests[0].body as Record<string, unknown>;
    expect(body.customer).toBe(`customers/${customerId}`);
  });

  it("uses orgunits/ prefix in policyQuery.orgUnit, never customers/", async () => {
    mockFetchSuccess();

    await createDLPRule(auth, customerId, ctx, {
      displayName: "Test rule",
      targetOrgUnit: "id:03ph8a2z221pcso",
      triggers: ["UPLOAD"],
      action: "AUDIT",
    });

    const body = capturedRequests[0].body as {
      policyQuery: { orgUnit: string };
    };
    expect(body.policyQuery.orgUnit).toStartWith("orgunits/");
    expect(body.policyQuery.orgUnit).not.toContain("customers/");
  });

  it("sets setting.type to rule.dlp", async () => {
    mockFetchSuccess();

    await createDLPRule(auth, customerId, ctx, {
      displayName: "Test rule",
      targetOrgUnit: "id:03ph8a2z221pcso",
      triggers: ["UPLOAD"],
      action: "AUDIT",
    });

    const body = capturedRequests[0].body as {
      setting: { type: string };
    };
    expect(body.setting.type).toBe("rule.dlp");
  });

  it("maps trigger names to chrome.* identifiers", async () => {
    mockFetchSuccess();

    await createDLPRule(auth, customerId, ctx, {
      displayName: "All triggers",
      targetOrgUnit: "id:03ph8a2z221pcso",
      triggers: ["UPLOAD", "DOWNLOAD", "PRINT", "CLIPBOARD"],
      action: "AUDIT",
    });

    const body = capturedRequests[0].body as {
      setting: { value: { triggers: string[] } };
    };
    expect(body.setting.value.triggers).toEqual([
      "chrome.file_upload",
      "chrome.file_download",
      "chrome.print",
      "chrome.clipboard",
    ]);
  });

  it("maps AUDIT action to AUDIT_ONLY", async () => {
    mockFetchSuccess();

    await createDLPRule(auth, customerId, ctx, {
      displayName: "Audit rule",
      targetOrgUnit: "id:03ph8a2z221pcso",
      triggers: ["UPLOAD"],
      action: "AUDIT",
    });

    const body = capturedRequests[0].body as {
      setting: { value: { action: string } };
    };
    expect(body.setting.value.action).toBe("AUDIT_ONLY");
  });

  it("maps WARN action to WARN_USER", async () => {
    mockFetchSuccess();

    await createDLPRule(auth, customerId, ctx, {
      displayName: "Warn rule",
      targetOrgUnit: "id:03ph8a2z221pcso",
      triggers: ["DOWNLOAD"],
      action: "WARN",
    });

    const body = capturedRequests[0].body as {
      setting: { value: { action: string } };
    };
    expect(body.setting.value.action).toBe("WARN_USER");
  });

  it("maps BLOCK action to BLOCK_CONTENT", async () => {
    mockFetchSuccess();

    await createDLPRule(auth, customerId, ctx, {
      displayName: "Block rule",
      targetOrgUnit: "id:03ph8a2z221pcso",
      triggers: ["PRINT"],
      action: "BLOCK",
    });

    const body = capturedRequests[0].body as {
      setting: { value: { action: string } };
    };
    expect(body.setting.value.action).toBe("BLOCK_CONTENT");
  });

  it("returns ui.success on successful API response", async () => {
    mockFetchSuccess("policies/new-rule-456");

    const result = await createDLPRule(auth, customerId, ctx, {
      displayName: "Success rule",
      targetOrgUnit: "id:03ph8a2z221pcso",
      triggers: ["UPLOAD"],
      action: "AUDIT",
    });

    expect(result._type).toBe("ui.success");
    expect(result.displayName).toBe("Success rule");
    if (result._type === "ui.success") {
      expect(result.ruleName).toBe("policies/new-rule-456");
    }
  });

  it("returns ui.error on API error", async () => {
    mockFetchError(403, "Permission denied");

    const result = await createDLPRule(auth, customerId, ctx, {
      displayName: "Forbidden rule",
      targetOrgUnit: "id:03ph8a2z221pcso",
      triggers: ["UPLOAD"],
      action: "AUDIT",
    });

    expect(result._type).toBe("ui.error");
    if (result._type === "ui.error") {
      expect(result.error).toBe("Permission denied");
    }
  });

  it("returns ui.manual_steps on fetch exception", async () => {
    globalThis.fetch = (() => {
      return Promise.reject(new Error("Network failure"));
    }) as unknown as typeof globalThis.fetch;

    const result = await createDLPRule(auth, customerId, ctx, {
      displayName: "Network error rule",
      targetOrgUnit: "id:03ph8a2z221pcso",
      triggers: ["UPLOAD"],
      action: "AUDIT",
    });

    expect(result._type).toBe("ui.manual_steps");
    if (result._type === "ui.manual_steps") {
      expect(result.error).toBe("Network failure");
    }
  });

  it("returns ui.error when OAuth2Client has no credentials", async () => {
    const noTokenAuth = new OAuth2Client();
    noTokenAuth.setCredentials({});

    const result = await createDLPRule(noTokenAuth, customerId, ctx, {
      displayName: "No token rule",
      targetOrgUnit: "id:03ph8a2z221pcso",
      triggers: ["UPLOAD"],
      action: "AUDIT",
    });

    expect(result._type).toBe("ui.error");
    if (result._type === "ui.error") {
      expect(result.error).toBe("Authentication required");
    }
  });

  it("includes displayName in setting.value.name", async () => {
    mockFetchSuccess();

    await createDLPRule(auth, customerId, ctx, {
      displayName: "My DLP Rule",
      targetOrgUnit: "id:03ph8a2z221pcso",
      triggers: ["UPLOAD"],
      action: "AUDIT",
    });

    const body = capturedRequests[0].body as {
      setting: { value: { name: string } };
    };
    expect(body.setting.value.name).toBe("My DLP Rule");
  });

  it("sets enabled to true in payload", async () => {
    mockFetchSuccess();

    await createDLPRule(auth, customerId, ctx, {
      displayName: "Enabled rule",
      targetOrgUnit: "id:03ph8a2z221pcso",
      triggers: ["UPLOAD"],
      action: "AUDIT",
    });

    const body = capturedRequests[0].body as {
      setting: { value: { enabled: boolean } };
    };
    expect(body.setting.value.enabled).toBe(true);
  });

  it("resolves '/' targetOrgUnit to root org unit ID in policyQuery", async () => {
    mockFetchSuccess();

    await createDLPRule(auth, customerId, ctx, {
      displayName: "Root DLP rule",
      targetOrgUnit: "/",
      triggers: ["UPLOAD"],
      action: "AUDIT",
    });

    const body = capturedRequests[0].body as {
      policyQuery: { orgUnit: string };
    };
    expect(body.policyQuery.orgUnit).toBe("orgunits/03ph8a2z23yjui6");
    expect(body.policyQuery.orgUnit).not.toBe("");
  });

  it("resolves path-based targetOrgUnit in policyQuery", async () => {
    mockFetchSuccess();

    await createDLPRule(auth, customerId, ctx, {
      displayName: "Engineering DLP rule",
      targetOrgUnit: "/Engineering",
      triggers: ["DOWNLOAD"],
      action: "BLOCK",
    });

    const body = capturedRequests[0].body as {
      policyQuery: { orgUnit: string };
    };
    expect(body.policyQuery.orgUnit).toBe("orgunits/03ph8a2z221pcso");
    expect(body.policyQuery.orgUnit).not.toStartWith("/");
  });

  it("policyQuery.orgUnit is never empty for any targetOrgUnit format", async () => {
    const inputs = ["/", "id:03ph8a2z221pcso", "orgunits/03ph8a2z221pcso"];

    for (const targetOrgUnit of inputs) {
      capturedRequests = [];
      mockFetchSuccess();

      await createDLPRule(auth, customerId, ctx, {
        displayName: `Rule for ${targetOrgUnit}`,
        targetOrgUnit,
        triggers: ["UPLOAD"],
        action: "AUDIT",
      });

      const body = capturedRequests[0].body as {
        policyQuery: { orgUnit: string };
      };
      expect(body.policyQuery.orgUnit).not.toBe("");
      expect(body.policyQuery.orgUnit).toStartWith("orgunits/");
    }
  });
});
