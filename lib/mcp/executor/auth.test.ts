/**
 * Unit tests for OAuth token validation (debugAuth).
 * Uses fetch mocking for deterministic testing without network calls.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { OAuth2Client } from "google-auth-library";

import { debugAuth } from "./auth";

describe("debugAuth", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns scopes and email for a valid token", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          scope:
            "https://www.googleapis.com/auth/admin.reports.audit.readonly https://www.googleapis.com/auth/chrome.management.policy.readonly",
          expires_in: 3200,
          email: "admin@example.com",
          access_type: "offline",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )) as unknown as typeof globalThis.fetch;

    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: "valid-token-123" });

    const result = await debugAuth(auth);

    expect(result).toHaveProperty("scopes");
    expect(result).not.toHaveProperty("error");
    if ("scopes" in result) {
      expect(result.scopes).toHaveLength(2);
      expect(result.scopes[0]).toContain("audit.readonly");
      expect(result.expiresIn).toBe(3200);
      expect(result.email).toBe("admin@example.com");
      expect(result.accessType).toBe("offline");
    }
  });

  it("returns error when token is expired", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })) as unknown as typeof globalThis.fetch;

    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: "expired-token" });

    const result = await debugAuth(auth);

    expect(result).toHaveProperty("error");
    if ("error" in result) {
      expect(result.error).toBe("invalid_token");
    }
  });

  it("throws when OAuth2Client has no credentials", async () => {
    const auth = new OAuth2Client();

    await expect(debugAuth(auth)).rejects.toThrow();
  });

  it("returns error on network failure", async () => {
    globalThis.fetch = (() =>
      Promise.reject(
        new Error("Network unreachable")
      )) as unknown as typeof globalThis.fetch;

    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: "some-token" });

    const result = await debugAuth(auth);

    expect(result).toHaveProperty("error");
    if ("error" in result) {
      expect(result.error).toBe("Network unreachable");
    }
  });

  it("calls correct tokeninfo URL with encoded token", async () => {
    let capturedUrl = "";

    globalThis.fetch = (async (url: string | URL | Request) => {
      capturedUrl = String(url);
      return new Response(
        JSON.stringify({
          scope: "https://www.googleapis.com/auth/admin.reports.audit.readonly",
          expires_in: 3600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof globalThis.fetch;

    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: "test-token" });

    await debugAuth(auth);

    expect(capturedUrl).toContain(
      "https://www.googleapis.com/oauth2/v1/tokeninfo"
    );
    expect(capturedUrl).toContain("access_token=test-token");
  });

  it("parses empty scope string as empty array", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ scope: "", expires_in: 3600 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as unknown as typeof globalThis.fetch;

    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: "token-no-scopes" });

    const result = await debugAuth(auth);

    expect(result).toHaveProperty("scopes");
    if ("scopes" in result) {
      expect(result.scopes).toEqual([]);
    }
  });
});
