/**
 * Unit tests for enrollment token generation.
 * Validates that policyTargetKey.targetResource always uses orgunits/ format,
 * never customers/ — which the Chrome Policy API rejects.
 */

import { describe, expect, it, mock } from "bun:test";
import { OAuth2Client } from "google-auth-library";
import { google as googleApis } from "googleapis";

import { type OrgUnitContext } from "./context";
import { enrollBrowser } from "./enrollment";

/**
 * Builds a mock OrgUnitContext with the given root org unit ID.
 */
function buildOrgUnitContext(rootOrgUnitId: string | null): OrgUnitContext {
  return {
    orgUnitList: [],
    orgUnitNameMap: new Map(),
    rootOrgUnitId,
    rootOrgUnitPath: rootOrgUnitId ? "/" : null,
  };
}

/**
 * Captures the targetResource sent to the enrollment API.
 */
function buildMockChromeManagement(capturedTargets: string[]) {
  const mockCreate = mock(
    (args: {
      parent: string;
      requestBody: {
        policySchemaId: string;
        policyTargetKey: { targetResource: string };
      };
    }) => {
      capturedTargets.push(args.requestBody.policyTargetKey.targetResource);
      return Promise.resolve({
        data: {
          name: "test-token-123",
          expirationTime: "2026-12-31T23:59:59Z",
        },
      });
    }
  );

  return mock(() => ({
    customers: {
      policies: {
        networks: {
          enrollments: {
            create: mockCreate,
          },
        },
      },
    },
  }));
}

describe("enrollBrowser target resource safety", () => {
  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: "fake-token" });

  it("uses orgunits/ format when orgUnitId is provided", async () => {
    const capturedTargets: string[] = [];
    const mockCM = buildMockChromeManagement(capturedTargets);
    const original = googleApis.chromemanagement;
    googleApis.chromemanagement =
      mockCM as unknown as typeof googleApis.chromemanagement;

    try {
      const ctx = buildOrgUnitContext("id:03ph8a2z23yjui6");
      const result = await enrollBrowser(auth, "my_customer", ctx, {
        orgUnitId: "id:03ph8a2z221pcso",
      });

      expect(capturedTargets).toHaveLength(1);
      expect(capturedTargets[0]).toStartWith("orgunits/");
      expect(capturedTargets[0]).not.toContain("customers/");
      expect("enrollmentToken" in result).toBe(true);
    } finally {
      googleApis.chromemanagement = original;
    }
  });

  it("falls back to root org unit when orgUnitId is omitted", async () => {
    const capturedTargets: string[] = [];
    const mockCM = buildMockChromeManagement(capturedTargets);
    const original = googleApis.chromemanagement;
    googleApis.chromemanagement =
      mockCM as unknown as typeof googleApis.chromemanagement;

    try {
      const ctx = buildOrgUnitContext("id:03ph8a2z23yjui6");
      const result = await enrollBrowser(auth, "my_customer", ctx, {});

      expect(capturedTargets).toHaveLength(1);
      expect(capturedTargets[0]).toBe("orgunits/03ph8a2z23yjui6");
      expect("enrollmentToken" in result).toBe(true);
    } finally {
      googleApis.chromemanagement = original;
    }
  });

  it("returns error when both orgUnitId and rootOrgUnitId are missing", async () => {
    const capturedTargets: string[] = [];
    const mockCM = buildMockChromeManagement(capturedTargets);
    const original = googleApis.chromemanagement;
    googleApis.chromemanagement =
      mockCM as unknown as typeof googleApis.chromemanagement;

    try {
      const ctx = buildOrgUnitContext(null);
      const result = await enrollBrowser(auth, "my_customer", ctx, {});

      expect(capturedTargets).toHaveLength(0);
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("No valid org unit target");
      }
    } finally {
      googleApis.chromemanagement = original;
    }
  });

  it("never sends customers/ as targetResource even if passed as orgUnitId", async () => {
    const capturedTargets: string[] = [];
    const mockCM = buildMockChromeManagement(capturedTargets);
    const original = googleApis.chromemanagement;
    googleApis.chromemanagement =
      mockCM as unknown as typeof googleApis.chromemanagement;

    try {
      const ctx = buildOrgUnitContext("id:03ph8a2z23yjui6");
      const result = await enrollBrowser(auth, "my_customer", ctx, {
        orgUnitId: "customers/my_customer",
      });

      // customers/ orgUnitId is rejected, falls back to root org unit
      expect(capturedTargets).toHaveLength(1);
      expect(capturedTargets[0]).toBe("orgunits/03ph8a2z23yjui6");
      expect(capturedTargets[0]).not.toContain("customers/");
      expect("enrollmentToken" in result).toBe(true);
    } finally {
      googleApis.chromemanagement = original;
    }
  });

  it("returns error when orgUnitId is customers/ and no root fallback", async () => {
    const capturedTargets: string[] = [];
    const mockCM = buildMockChromeManagement(capturedTargets);
    const original = googleApis.chromemanagement;
    googleApis.chromemanagement =
      mockCM as unknown as typeof googleApis.chromemanagement;

    try {
      const ctx = buildOrgUnitContext(null);
      const result = await enrollBrowser(auth, "my_customer", ctx, {
        orgUnitId: "customers/my_customer",
      });

      // No API call should be made
      expect(capturedTargets).toHaveLength(0);
      expect("error" in result).toBe(true);
    } finally {
      googleApis.chromemanagement = original;
    }
  });
});
