/**
 * Unit tests for enrollment token resolution from fixture data.
 * Covers all five code paths: undefined fixture, expired, revoked, custom error, valid.
 */

import { describe, expect, it } from "bun:test";

import { resolveEnrollmentToken } from "./fixture-enrollment";

describe("resolveEnrollmentToken", () => {
  it("returns default token when fixture is undefined", () => {
    const result = resolveEnrollmentToken(undefined);

    expect("enrollmentToken" in result).toBe(true);
    if ("enrollmentToken" in result) {
      expect(result.enrollmentToken).toBe("fixture-enrollment-token-12345");
      expect(result.expiresAt).toBeDefined();
    }
  });

  it("returns error for expired status", () => {
    const result = resolveEnrollmentToken({ status: "expired" });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("expired");
      expect(result.suggestion).toContain("Generate a new");
    }
  });

  it("returns error for revoked status", () => {
    const result = resolveEnrollmentToken({ status: "revoked" });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("revoked");
      expect(result.suggestion).toContain("Generate a new");
    }
  });

  it("returns custom error when fixture has error string", () => {
    const result = resolveEnrollmentToken({
      error: "Insufficient permissions for enrollment",
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("Insufficient permissions for enrollment");
      expect(result.suggestion).toBeDefined();
    }
  });

  it("returns custom token from fixture when valid", () => {
    const result = resolveEnrollmentToken({
      token: "custom-token-xyz",
      expiresAt: "2026-12-31T23:59:59Z",
      status: "valid",
    });

    expect("enrollmentToken" in result).toBe(true);
    if ("enrollmentToken" in result) {
      expect(result.enrollmentToken).toBe("custom-token-xyz");
      expect(result.expiresAt).toBe("2026-12-31T23:59:59Z");
    }
  });

  it("returns default token when fixture has no token field", () => {
    const result = resolveEnrollmentToken({});

    expect("enrollmentToken" in result).toBe(true);
    if ("enrollmentToken" in result) {
      expect(result.enrollmentToken).toBe("fixture-enrollment-token-12345");
      expect(result.expiresAt).toBeNull();
    }
  });

  it("prioritizes status error over custom error field", () => {
    const result = resolveEnrollmentToken({
      status: "expired",
      error: "Custom error",
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("expired");
    }
  });
});
