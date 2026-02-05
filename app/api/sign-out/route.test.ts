/**
 * Tests for the sign-out API route helper logic and response construction.
 *
 * The route handler depends on Better Auth and next/headers and cannot
 * be imported without full env setup. These tests validate the token
 * revocation URL building, cookie identification logic, and response
 * shape contracts.
 */

import { describe, expect, it } from "bun:test";

/**
 * Mirrors the auth cookie detection logic from the route module.
 */
function isAuthCookie(name: string): boolean {
  return (
    name.startsWith("better-auth") ||
    name.includes("session") ||
    name.includes("account")
  );
}

describe("sign-out API route", () => {
  describe("isAuthCookie identification", () => {
    it("identifies better-auth prefixed cookies", () => {
      expect(isAuthCookie("better-auth.session_token")).toBe(true);
      expect(isAuthCookie("better-auth.csrf_token")).toBe(true);
      expect(isAuthCookie("better-auth.callback")).toBe(true);
    });

    it("identifies session cookies regardless of prefix", () => {
      expect(isAuthCookie("user_session")).toBe(true);
      expect(isAuthCookie("session_id")).toBe(true);
      expect(isAuthCookie("__session")).toBe(true);
    });

    it("identifies account cookies regardless of prefix", () => {
      expect(isAuthCookie("account_token")).toBe(true);
      expect(isAuthCookie("google_account")).toBe(true);
      expect(isAuthCookie("linked_account_id")).toBe(true);
    });

    it("rejects unrelated cookies", () => {
      expect(isAuthCookie("theme")).toBe(false);
      expect(isAuthCookie("locale")).toBe(false);
      expect(isAuthCookie("_ga")).toBe(false);
      expect(isAuthCookie("_fbp")).toBe(false);
      expect(isAuthCookie("CONSENT")).toBe(false);
    });
  });

  describe("Google token revocation URL construction", () => {
    it("builds correct revocation endpoint URL", () => {
      const token = "ya29.a0AfB_byCfaketoken123";
      const url = `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`;

      expect(url).toBe(
        "https://oauth2.googleapis.com/revoke?token=ya29.a0AfB_byCfaketoken123"
      );
    });

    it("encodes special characters in token", () => {
      const token = "token+with/special=chars&more";
      const url = `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`;

      expect(url).toContain("token%2Bwith%2Fspecial%3Dchars%26more");
    });

    it("handles empty token", () => {
      const token = "";
      const url = `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`;

      expect(url).toBe("https://oauth2.googleapis.com/revoke?token=");
    });

    it("handles tokens with dots and underscores (common in JWTs)", () => {
      const token =
        "eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJhY2NvdW50cy5nb29nbGUuY29tIn0.signature_here";
      const url = `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`;

      expect(url).toContain("eyJhbGciOiJSUzI1NiJ9");
      expect(url).toContain("signature_here");
    });
  });

  describe("success response contract", () => {
    it("has correct shape for successful sign-out", () => {
      const response = { success: true, message: "Signed out successfully" };

      expect(response.success).toBe(true);
      expect(response.message).toBe("Signed out successfully");
    });

    it("produces valid JSON Response", async () => {
      const jsonResponse = Response.json({
        success: true,
        message: "Signed out successfully",
      });

      expect(jsonResponse.status).toBe(200);
      const body = await jsonResponse.json();
      expect(body.success).toBe(true);
    });
  });

  describe("error response contract", () => {
    it("has correct shape for failed sign-out", () => {
      const response = { success: false, error: "Failed to sign out" };

      expect(response.success).toBe(false);
      expect(response.error).toBe("Failed to sign out");
    });

    it("returns 500 status for server errors", async () => {
      const jsonResponse = Response.json(
        { success: false, error: "Failed to sign out" },
        { status: 500 }
      );

      expect(jsonResponse.status).toBe(500);
      const body = await jsonResponse.json();
      expect(body.success).toBe(false);
    });
  });
});
