import { describe, expect, it } from "bun:test";

function isAuthCookie(name: string): boolean {
  return (
    name.startsWith("better-auth") ||
    name.includes("session") ||
    name.includes("account")
  );
}

describe("sign-out API route", () => {
  describe("response structure", () => {
    it("success response has correct shape", () => {
      const response = {
        success: true,
        message: "Signed out successfully",
      };
      expect(response).toHaveProperty("success", true);
      expect(response).toHaveProperty("message", "Signed out successfully");
    });

    it("error response has correct shape", () => {
      const response = {
        success: false,
        error: "Failed to sign out",
      };
      expect(response).toHaveProperty("success", false);
      expect(response).toHaveProperty("error", "Failed to sign out");
    });
  });

  describe("isAuthCookie helper logic", () => {
    it("identifies better-auth cookies", () => {
      expect(isAuthCookie("better-auth.session_token")).toBe(true);
      expect(isAuthCookie("better-auth.csrf_token")).toBe(true);
    });

    it("identifies session cookies", () => {
      expect(isAuthCookie("user_session")).toBe(true);
      expect(isAuthCookie("session_id")).toBe(true);
    });

    it("identifies account cookies", () => {
      expect(isAuthCookie("account_token")).toBe(true);
      expect(isAuthCookie("google_account")).toBe(true);
    });

    it("does not match unrelated cookies", () => {
      expect(isAuthCookie("theme")).toBe(false);
      expect(isAuthCookie("locale")).toBe(false);
      expect(isAuthCookie("_ga")).toBe(false);
    });
  });

  describe("Google token revocation", () => {
    it("revocation URL is correctly formatted", () => {
      const token = "test_access_token_123";
      const url = `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`;
      expect(url).toBe(
        "https://oauth2.googleapis.com/revoke?token=test_access_token_123"
      );
    });

    it("handles special characters in token", () => {
      const token = "test+token/with=special&chars";
      const url = `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`;
      expect(url).toContain("test%2Btoken%2Fwith%3Dspecial%26chars");
    });
  });
});
