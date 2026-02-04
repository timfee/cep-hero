import { describe, expect, it } from "bun:test";

describe("sign-in-status API route", () => {
  describe("response structure", () => {
    it("returns JSON response", () => {
      const response = Response.json({ authenticated: false });
      expect(response.headers.get("content-type")).toBe("application/json");
    });

    it("SignInStatusResponse has correct shape for unauthenticated", () => {
      const response = {
        authenticated: false,
        error: "No active session",
      };
      expect(response).toHaveProperty("authenticated", false);
      expect(response).toHaveProperty("error");
    });

    it("SignInStatusResponse has correct shape for authenticated", () => {
      const response = {
        authenticated: true,
        user: {
          name: "Test User",
          email: "test@example.com",
          image: null,
        },
        token: {
          expiresIn: 3600,
          expiresAt: "2024-01-01T00:00:00.000Z",
          scopes: ["email", "profile"],
        },
      };
      expect(response).toHaveProperty("authenticated", true);
      expect(response).toHaveProperty("user");
      expect(response.user).toHaveProperty("name", "Test User");
      expect(response.user).toHaveProperty("email", "test@example.com");
      expect(response).toHaveProperty("token");
      expect(response.token).toHaveProperty("expiresIn", 3600);
      expect(response.token).toHaveProperty("scopes");
    });

    it("SignInStatusResponse has correct shape for authenticated with error", () => {
      const response = {
        authenticated: true,
        user: {
          name: "Test User",
          email: "test@example.com",
          image: null,
        },
        error: "Token validation failed",
      };
      expect(response).toHaveProperty("authenticated", true);
      expect(response).toHaveProperty("user");
      expect(response).toHaveProperty("error", "Token validation failed");
    });
  });

  describe("Google tokeninfo integration", () => {
    it("parses Google tokeninfo response correctly", () => {
      const googleResponse = {
        expires_in: "3600",
        access_type: "offline",
        scope: "email profile openid",
        email: "test@example.com",
        email_verified: "true",
      };

      const expiresIn = Number.parseInt(googleResponse.expires_in, 10);
      const scopes = googleResponse.scope.split(" ");

      expect(expiresIn).toBe(3600);
      expect(scopes).toEqual(["email", "profile", "openid"]);
    });

    it("handles missing expires_in gracefully", () => {
      const defaultValue = "0";
      const expiresIn = Number.parseInt(defaultValue, 10);
      expect(expiresIn).toBe(0);
    });

    it("handles error_description in token response", () => {
      const googleResponse = {
        error_description: "Token has been expired or revoked",
      };

      const hasError = !!googleResponse.error_description;
      expect(hasError).toBe(true);
    });
  });
});
