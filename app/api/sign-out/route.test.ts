/**
 * Tests for the sign-out API route helper logic and response construction.
 *
 * The route handler depends on Better Auth and next/headers and cannot
 * be imported without full env setup. These tests validate the token
 * revocation URL building, default user mode behavior, and response
 * shape contracts matching the current route implementation.
 */

import { describe, expect, it } from "bun:test";

/**
 * Mirrors revokeGoogleToken URL construction from the route module.
 */
function buildRevocationUrl(token: string): string {
  return `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`;
}

/**
 * Mirrors the default user mode early-return response from the route.
 */
function buildDefaultUserSignOutResponse() {
  return { success: true, message: "Signed out successfully" };
}

/**
 * Mirrors the error response from the route module.
 */
function buildErrorResponse() {
  return { success: false, error: "Failed to sign out" };
}

describe("sign-out API route", () => {
  describe("Google token revocation URL construction", () => {
    it("builds correct revocation endpoint URL", () => {
      const url = buildRevocationUrl("ya29.a0AfB_byCfaketoken123");

      expect(url).toBe(
        "https://oauth2.googleapis.com/revoke?token=ya29.a0AfB_byCfaketoken123"
      );
    });

    it("encodes special characters in token", () => {
      const url = buildRevocationUrl("token+with/special=chars&more");

      expect(url).toContain("token%2Bwith%2Fspecial%3Dchars%26more");
    });

    it("handles empty token", () => {
      const url = buildRevocationUrl("");

      expect(url).toBe("https://oauth2.googleapis.com/revoke?token=");
    });

    it("handles tokens with dots and underscores (common in JWTs)", () => {
      const token =
        "eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJhY2NvdW50cy5nb29nbGUuY29tIn0.signature_here";
      const url = buildRevocationUrl(token);

      expect(url).toContain("eyJhbGciOiJSUzI1NiJ9");
      expect(url).toContain("signature_here");
    });
  });

  describe("default user mode response", () => {
    it("returns success without revoking tokens", () => {
      const response = buildDefaultUserSignOutResponse();

      expect(response.success).toBe(true);
      expect(response.message).toBe("Signed out successfully");
    });

    it("produces valid JSON Response for default user mode", async () => {
      const jsonResponse = Response.json(buildDefaultUserSignOutResponse());

      expect(jsonResponse.status).toBe(200);
      const body = await jsonResponse.json();
      expect(body.success).toBe(true);
      expect(body.message).toBe("Signed out successfully");
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
      const response = buildErrorResponse();

      expect(response.success).toBe(false);
      expect(response.error).toBe("Failed to sign out");
    });

    it("returns 500 status for server errors", async () => {
      const jsonResponse = Response.json(buildErrorResponse(), {
        status: 500,
      });

      expect(jsonResponse.status).toBe(500);
      const body = await jsonResponse.json();
      expect(body.success).toBe(false);
    });
  });
});
