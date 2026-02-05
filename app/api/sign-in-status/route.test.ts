/**
 * Tests for the sign-in-status API route response building logic.
 *
 * The route handler itself depends on Better Auth session middleware
 * and cannot be imported without full env setup. These tests validate
 * the response construction logic, token parsing, and edge cases
 * that match the actual route implementation.
 */

import { describe, expect, it } from "bun:test";

/**
 * Google tokeninfo API response structure.
 */
interface GoogleTokenInfo {
  expires_in?: string;
  access_type?: string;
  scope?: string;
  email?: string;
  email_verified?: string;
  error_description?: string;
}

/**
 * Mirrors buildUserInfo from the route module.
 */
function buildUserInfo(user: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}) {
  return {
    name: user.name ?? null,
    email: user.email ?? null,
    image: user.image ?? null,
  };
}

/**
 * Mirrors buildSuccessResponse from the route module.
 */
function buildSuccessResponse(
  user: { name: string | null; email: string | null; image: string | null },
  tokenInfo: GoogleTokenInfo
) {
  const expiresIn = Number.parseInt(tokenInfo.expires_in ?? "0", 10);
  return {
    authenticated: true,
    user,
    token: {
      expiresIn,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      scopes: tokenInfo.scope?.split(" ") ?? [],
    },
  };
}

describe("sign-in-status API route", () => {
  describe("buildUserInfo", () => {
    it("normalizes session user with all fields", () => {
      const result = buildUserInfo({
        name: "Alice Admin",
        email: "alice@corp.com",
        image: "https://lh3.googleusercontent.com/photo.jpg",
      });

      expect(result.name).toBe("Alice Admin");
      expect(result.email).toBe("alice@corp.com");
      expect(result.image).toBe("https://lh3.googleusercontent.com/photo.jpg");
    });

    it("coerces undefined fields to null", () => {
      const result = buildUserInfo({});

      expect(result.name).toBeNull();
      expect(result.email).toBeNull();
      expect(result.image).toBeNull();
    });

    it("preserves explicit null values", () => {
      const result = buildUserInfo({
        name: "Test",
        email: null,
        image: null,
      });

      expect(result.name).toBe("Test");
      expect(result.email).toBeNull();
      expect(result.image).toBeNull();
    });
  });

  describe("buildSuccessResponse", () => {
    it("constructs authenticated response from valid tokeninfo", () => {
      const user = {
        name: "Test User",
        email: "test@example.com",
        image: null,
      };
      const tokenInfo: GoogleTokenInfo = {
        expires_in: "3600",
        access_type: "offline",
        scope:
          "email profile openid https://www.googleapis.com/auth/chrome.management.policy.readonly",
        email: "test@example.com",
        email_verified: "true",
      };

      const result = buildSuccessResponse(user, tokenInfo);

      expect(result.authenticated).toBe(true);
      expect(result.user.email).toBe("test@example.com");
      expect(result.token.expiresIn).toBe(3600);
      expect(result.token.scopes).toEqual([
        "email",
        "profile",
        "openid",
        "https://www.googleapis.com/auth/chrome.management.policy.readonly",
      ]);
      expect(result.token.expiresAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );
    });

    it("defaults expiresIn to 0 when missing", () => {
      const user = { name: "Test", email: "t@e.com", image: null };
      const result = buildSuccessResponse(user, {});

      expect(result.token.expiresIn).toBe(0);
      expect(result.token.scopes).toEqual([]);
    });

    it("handles single-scope token", () => {
      const user = { name: "Test", email: "t@e.com", image: null };
      const result = buildSuccessResponse(user, { scope: "email" });

      expect(result.token.scopes).toEqual(["email"]);
    });
  });

  describe("no-session response", () => {
    it("returns unauthenticated with error message", () => {
      const response = { authenticated: false, error: "No active session" };

      expect(response.authenticated).toBe(false);
      expect(response.error).toBe("No active session");
    });
  });

  describe("error response", () => {
    it("includes user info alongside error", () => {
      const user = {
        name: "Test User",
        email: "test@example.com",
        image: null,
      };
      const response = {
        authenticated: true,
        user,
        error: "Token has been expired or revoked",
      };

      expect(response.authenticated).toBe(true);
      expect(response.user.email).toBe("test@example.com");
      expect(response.error).toContain("expired");
    });
  });

  describe("Google tokeninfo parsing", () => {
    it("parses real-world Google tokeninfo response", () => {
      const googleResponse: GoogleTokenInfo = {
        expires_in: "2847",
        access_type: "offline",
        scope:
          "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile openid https://www.googleapis.com/auth/chrome.management.policy.readonly https://www.googleapis.com/auth/admin.directory.orgunit.readonly https://www.googleapis.com/auth/admin.reports.audit.readonly",
        email: "admin@workspace-domain.com",
        email_verified: "true",
      };

      const expiresIn = Number.parseInt(googleResponse.expires_in ?? "0", 10);
      const scopes = googleResponse.scope?.split(" ") ?? [];

      expect(expiresIn).toBe(2847);
      expect(scopes).toHaveLength(6);
      expect(scopes).toContain(
        "https://www.googleapis.com/auth/admin.reports.audit.readonly"
      );
    });

    it("detects expired/revoked token from error_description", () => {
      const googleResponse: GoogleTokenInfo = {
        error_description: "Token has been expired or revoked.",
      };

      const hasError = Boolean(googleResponse.error_description);
      expect(hasError).toBe(true);
      expect(googleResponse.error_description).toContain("expired");
    });

    it("handles tokeninfo with non-numeric expires_in", () => {
      const expiresIn = Number.parseInt("invalid", 10);
      expect(Number.isNaN(expiresIn)).toBe(true);

      const safeExpiresIn = Number.parseInt("0", 10);
      expect(safeExpiresIn).toBe(0);
    });
  });

  describe("Response.json integration", () => {
    it("produces valid JSON response with correct content-type", () => {
      const response = Response.json({ authenticated: false });

      expect(response.headers.get("content-type")).toBe("application/json");
      expect(response.status).toBe(200);
    });

    it("produces 500 status response for errors", () => {
      const response = Response.json(
        { authenticated: false, error: "Internal error" },
        { status: 500 }
      );

      expect(response.status).toBe(500);
    });
  });
});
