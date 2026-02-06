/**
 * Unit tests for API error handling utilities.
 * Covers discriminated union constructors, type guards, error detail extraction,
 * and reauth detection across numeric and string status codes.
 */

import { describe, expect, it } from "bun:test";

import {
  createApiError,
  err,
  getErrorDetails,
  getErrorMessage,
  isApiError,
  isError,
  isSuccess,
  ok,
} from "./errors";

describe("ok and err constructors", () => {
  it("ok wraps data with success: true", () => {
    const result = ok({ id: 1 });
    expect(result).toEqual({ success: true, data: { id: 1 } });
  });

  it("err wraps error with success: false and defaults requiresReauth to false", () => {
    const result = err("fail", "try again");
    expect(result).toEqual({
      success: false,
      error: "fail",
      suggestion: "try again",
      requiresReauth: false,
    });
  });

  it("err sets requiresReauth when explicitly passed", () => {
    const result = err("expired", "re-login", true);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.requiresReauth).toBe(true);
    }
  });
});

describe("isSuccess and isError type guards", () => {
  it("isSuccess returns true for ok results", () => {
    expect(isSuccess(ok("data"))).toBe(true);
  });

  it("isSuccess returns false for err results", () => {
    expect(isSuccess(err("bad", "fix"))).toBe(false);
  });

  it("isError returns true for err results", () => {
    expect(isError(err("bad", "fix"))).toBe(true);
  });

  it("isError returns false for ok results", () => {
    expect(isError(ok("data"))).toBe(false);
  });
});

describe("isApiError", () => {
  it("identifies objects with a string error field as API errors", () => {
    expect(
      isApiError({
        error: "something broke",
        suggestion: "fix it",
        requiresReauth: false,
      })
    ).toBe(true);
  });

  it("rejects null", () => {
    expect(isApiError(null as unknown)).toBe(false);
  });

  it("rejects primitives", () => {
    expect(isApiError("string")).toBe(false);
    expect(isApiError(42)).toBe(false);
    expect(isApiError(undefined)).toBe(false);
  });

  it("rejects objects without an error field", () => {
    expect(isApiError({ data: "hello" })).toBe(false);
  });

  it("rejects objects where error is not a string", () => {
    expect(isApiError({ error: 404 })).toBe(false);
  });
});

describe("getErrorDetails", () => {
  it("extracts code and message from error-shaped objects", () => {
    const details = getErrorDetails({ code: 404, message: "Not found" });
    expect(details.code).toBe(404);
    expect(details.message).toBe("Not found");
  });

  it("extracts string codes", () => {
    const details = getErrorDetails({ code: "403", message: "Forbidden" });
    expect(details.code).toBe("403");
  });

  it("returns empty object for non-object errors", () => {
    expect(getErrorDetails("just a string")).toEqual({});
    expect(getErrorDetails(null)).toEqual({});
    expect(getErrorDetails(undefined)).toEqual({});
    expect(getErrorDetails(42)).toEqual({});
  });

  it("returns undefined code/message when properties are missing", () => {
    const details = getErrorDetails({});
    expect(details.code).toBeUndefined();
    expect(details.message).toBeUndefined();
  });

  it("passes through the errors property if present", () => {
    const innerErrors = [{ reason: "bad" }];
    const details = getErrorDetails({ errors: innerErrors });
    expect(details.errors).toBe(innerErrors);
  });
});

describe("getErrorMessage", () => {
  it("extracts message from Error instances", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("extracts message from plain objects with a message field", () => {
    expect(getErrorMessage({ message: "oops" })).toBe("oops");
  });

  it("returns 'Unknown error' for primitives", () => {
    expect(getErrorMessage(null)).toBe("Unknown error");
    expect(getErrorMessage(42)).toBe("Unknown error");
    expect(getErrorMessage("string")).toBe("Unknown error");
  });

  it("returns 'Unknown error' for objects without a message field", () => {
    expect(getErrorMessage({ code: 500 })).toBe("Unknown error");
  });
});

describe("createApiError", () => {
  it("returns session expired suggestion for 401 Unauthorized", () => {
    const result = createApiError(
      { code: 401, message: "Auth failed" },
      "chrome-events"
    );
    expect(result.error).toBe("Auth failed");
    expect(result.suggestion).toContain("session has expired");
    expect(result.requiresReauth).toBe(true);
  });

  it("returns session expired suggestion for 403 Forbidden", () => {
    const result = createApiError(
      { code: 403, message: "Forbidden" },
      "dlp-rules"
    );
    expect(result.requiresReauth).toBe(true);
    expect(result.suggestion).toContain("session has expired");
  });

  it("handles string code '401' as reauth-required", () => {
    const result = createApiError(
      { code: "401", message: "Unauthorized" },
      "org-units"
    );
    expect(result.requiresReauth).toBe(true);
    expect(result.suggestion).toContain("session has expired");
  });

  it("handles string code '403' as reauth-required", () => {
    const result = createApiError(
      { code: "403", message: "Forbidden" },
      "org-units"
    );
    expect(result.requiresReauth).toBe(true);
  });

  it("uses context default suggestion for non-auth error codes", () => {
    const result = createApiError(
      { code: 500, message: "Server error" },
      "chrome-events"
    );
    expect(result.requiresReauth).toBe(false);
    expect(result.suggestion).toContain("Admin SDK");
  });

  it("uses correct default suggestion per context key", () => {
    const dlp = createApiError({ code: 500, message: "err" }, "dlp-rules");
    expect(dlp.suggestion).toContain("Cloud Identity API");

    const orgUnits = createApiError({ code: 500, message: "err" }, "org-units");
    expect(orgUnits.suggestion).toContain("Admin SDK");

    const enroll = createApiError(
      { code: 500, message: "err" },
      "enroll-browser"
    );
    expect(enroll.suggestion).toContain("Chrome Browser Cloud Management API");

    const connector = createApiError(
      { code: 500, message: "err" },
      "connector-config"
    );
    expect(connector.suggestion).toContain("Chrome Policy API");
  });

  it("falls back to 'Unknown error' for non-object errors", () => {
    const result = createApiError("raw string", "chrome-events");
    expect(result.error).toBe("Unknown error");
    expect(result.requiresReauth).toBe(false);
  });

  it("falls back to 'Unknown error' for null", () => {
    const result = createApiError(null, "dlp-rules");
    expect(result.error).toBe("Unknown error");
  });

  it("falls back to 'Unknown error' for objects missing a message field", () => {
    const result = createApiError({ code: 404 }, "chrome-events");
    expect(result.error).toBe("Unknown error");
    expect(result.requiresReauth).toBe(false);
  });
});
