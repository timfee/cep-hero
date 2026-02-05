/**
 * Tests for the default user auto-sign-in feature configuration.
 *
 * These tests exercise isDefaultUserEnabled and getDefaultUserEmail
 * which rely on process.env. Each test saves and restores the
 * relevant env vars to avoid cross-test pollution.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { getDefaultUserEmail, isDefaultUserEnabled } from "./default-user";

/**
 * Saved env values restored after each test.
 */
let savedUseDefaultUser: string | undefined;
let savedTokenEmail: string | undefined;

beforeEach(() => {
  savedUseDefaultUser = process.env.USE_DEFAULT_USER;
  savedTokenEmail = process.env.GOOGLE_TOKEN_EMAIL;
});

afterEach(() => {
  if (savedUseDefaultUser === undefined) {
    delete process.env.USE_DEFAULT_USER;
  } else {
    process.env.USE_DEFAULT_USER = savedUseDefaultUser;
  }

  if (savedTokenEmail === undefined) {
    delete process.env.GOOGLE_TOKEN_EMAIL;
  } else {
    process.env.GOOGLE_TOKEN_EMAIL = savedTokenEmail;
  }
});

describe("isDefaultUserEnabled", () => {
  it("returns false when USE_DEFAULT_USER is not set", () => {
    delete process.env.USE_DEFAULT_USER;
    expect(isDefaultUserEnabled()).toBe(false);
  });

  it("returns false when USE_DEFAULT_USER is empty string", () => {
    process.env.USE_DEFAULT_USER = "";
    expect(isDefaultUserEnabled()).toBe(false);
  });

  it("returns false when USE_DEFAULT_USER is an unrecognized value", () => {
    process.env.USE_DEFAULT_USER = "yes";
    process.env.GOOGLE_TOKEN_EMAIL = "admin@corp.com";
    expect(isDefaultUserEnabled()).toBe(false);
  });

  it('returns true when USE_DEFAULT_USER is "true" and email is set', () => {
    process.env.USE_DEFAULT_USER = "true";
    process.env.GOOGLE_TOKEN_EMAIL = "admin@corp.com";
    expect(isDefaultUserEnabled()).toBe(true);
  });

  it('returns true when USE_DEFAULT_USER is "1" and email is set', () => {
    process.env.USE_DEFAULT_USER = "1";
    process.env.GOOGLE_TOKEN_EMAIL = "admin@corp.com";
    expect(isDefaultUserEnabled()).toBe(true);
  });

  it("returns false when USE_DEFAULT_USER is true but GOOGLE_TOKEN_EMAIL is missing", () => {
    process.env.USE_DEFAULT_USER = "true";
    delete process.env.GOOGLE_TOKEN_EMAIL;
    expect(isDefaultUserEnabled()).toBe(false);
  });

  it("returns false when USE_DEFAULT_USER is true but GOOGLE_TOKEN_EMAIL is empty", () => {
    process.env.USE_DEFAULT_USER = "true";
    process.env.GOOGLE_TOKEN_EMAIL = "";
    expect(isDefaultUserEnabled()).toBe(false);
  });
});

describe("getDefaultUserEmail", () => {
  it("returns null when default user mode is disabled", () => {
    delete process.env.USE_DEFAULT_USER;
    expect(getDefaultUserEmail()).toBeNull();
  });

  it("returns email when default user mode is enabled", () => {
    process.env.USE_DEFAULT_USER = "true";
    process.env.GOOGLE_TOKEN_EMAIL = "admin@corp.com";
    expect(getDefaultUserEmail()).toBe("admin@corp.com");
  });

  it("strips surrounding single quotes from email", () => {
    process.env.USE_DEFAULT_USER = "true";
    process.env.GOOGLE_TOKEN_EMAIL = "'admin@corp.com'";
    expect(getDefaultUserEmail()).toBe("admin@corp.com");
  });

  it("strips surrounding double quotes from email", () => {
    process.env.USE_DEFAULT_USER = "true";
    process.env.GOOGLE_TOKEN_EMAIL = '"admin@corp.com"';
    expect(getDefaultUserEmail()).toBe("admin@corp.com");
  });

  it("returns email unchanged when no quotes present", () => {
    process.env.USE_DEFAULT_USER = "1";
    process.env.GOOGLE_TOKEN_EMAIL = "test@example.com";
    expect(getDefaultUserEmail()).toBe("test@example.com");
  });
});
