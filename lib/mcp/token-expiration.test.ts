import { describe, expect, it } from "bun:test";

import { isTokenExpiredError } from "@/lib/mcp/registry";

describe("isTokenExpiredError", () => {
  describe("HTTP status code detection", () => {
    it("returns true for numeric 401 code", () => {
      expect(isTokenExpiredError(401, undefined)).toBe(true);
    });

    it("returns true for string '401' code", () => {
      expect(isTokenExpiredError("401", undefined)).toBe(true);
    });

    it("returns false for non-401 numeric codes", () => {
      expect(isTokenExpiredError(200, undefined)).toBe(false);
      expect(isTokenExpiredError(403, undefined)).toBe(false);
      expect(isTokenExpiredError(500, undefined)).toBe(false);
    });

    it("returns false for non-numeric string codes", () => {
      expect(isTokenExpiredError("abc", undefined)).toBe(false);
      expect(isTokenExpiredError("error", undefined)).toBe(false);
    });

    it("returns false for undefined code", () => {
      expect(isTokenExpiredError(undefined, undefined)).toBe(false);
    });
  });

  describe("error message pattern detection", () => {
    it("matches 'Request had invalid authentication credentials'", () => {
      expect(
        isTokenExpiredError(
          undefined,
          "Request had invalid authentication credentials. Expected OAuth 2 access token"
        )
      ).toBe(true);
    });

    it("matches 'Invalid Credentials'", () => {
      expect(isTokenExpiredError(undefined, "Invalid Credentials")).toBe(true);
    });

    it("matches 'Token has been expired or revoked'", () => {
      expect(
        isTokenExpiredError(undefined, "Token has been expired or revoked")
      ).toBe(true);
    });

    it("is case-insensitive for pattern matching", () => {
      expect(isTokenExpiredError(undefined, "invalid credentials")).toBe(true);
      expect(isTokenExpiredError(undefined, "INVALID CREDENTIALS")).toBe(true);
      expect(
        isTokenExpiredError(
          undefined,
          "request had invalid authentication credentials"
        )
      ).toBe(true);
      expect(
        isTokenExpiredError(undefined, "token has been expired or revoked")
      ).toBe(true);
    });

    it("returns false for unrelated error messages", () => {
      expect(isTokenExpiredError(undefined, "Not found")).toBe(false);
      expect(isTokenExpiredError(undefined, "Permission denied")).toBe(false);
      expect(isTokenExpiredError(undefined, "Rate limit exceeded")).toBe(false);
    });

    it("returns false for undefined message", () => {
      expect(isTokenExpiredError(undefined, undefined)).toBe(false);
    });
  });

  describe("combined code and message detection", () => {
    it("returns true when code is 401 regardless of message", () => {
      expect(isTokenExpiredError(401, "Some other error")).toBe(true);
      expect(isTokenExpiredError(401, undefined)).toBe(true);
    });

    it("returns true when message matches regardless of code", () => {
      expect(isTokenExpiredError(500, "Invalid Credentials")).toBe(true);
      expect(isTokenExpiredError(undefined, "Invalid Credentials")).toBe(true);
    });

    it("returns false when neither code nor message match", () => {
      expect(isTokenExpiredError(500, "Server error")).toBe(false);
      expect(isTokenExpiredError(403, "Forbidden")).toBe(false);
    });
  });
});
