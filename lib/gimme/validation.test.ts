/**
 * Tests for gimme enrollment validation utilities.
 * Covers quote stripping, name parsing, username extraction,
 * password generation, and enrollment schema validation.
 */

import { describe, expect, it } from "bun:test";

import {
  EnrollmentSchema,
  extractUsername,
  generatePassword,
  parseName,
  stripQuotes,
} from "./validation";

describe("stripQuotes", () => {
  it("strips surrounding single quotes", () => {
    expect(stripQuotes("'hello'")).toBe("hello");
  });

  it("strips surrounding double quotes", () => {
    expect(stripQuotes('"hello"')).toBe("hello");
  });

  it("leaves unquoted values unchanged", () => {
    expect(stripQuotes("hello")).toBe("hello");
  });

  it("strips only outer quotes, not inner ones", () => {
    expect(stripQuotes("'it's a test'")).toBe("it's a test");
  });

  it("returns undefined for undefined input", () => {
    expect(stripQuotes(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(stripQuotes("")).toBeUndefined();
  });

  it("strips mismatched quotes (single open, double close)", () => {
    // replaceAll removes leading ' and trailing "
    expect(stripQuotes("'hello\"")).toBe("hello");
  });

  it("handles JSON string with surrounding quotes from env", () => {
    const envValue = "'eyJjbGllbnRfZW1haWwiOiJ0ZXN0In0='";
    expect(stripQuotes(envValue)).toBe("eyJjbGllbnRfZW1haWwiOiJ0ZXN0In0=");
  });
});

describe("parseName", () => {
  it("splits first and family name on whitespace", () => {
    expect(parseName("John Doe")).toEqual({
      givenName: "John",
      familyName: "Doe",
    });
  });

  it("uses first word as given, rest as family for multi-part names", () => {
    expect(parseName("Mary Jane Watson")).toEqual({
      givenName: "Mary",
      familyName: "Jane Watson",
    });
  });

  it("uses single name for both given and family when no space", () => {
    expect(parseName("Madonna")).toEqual({
      givenName: "Madonna",
      familyName: "Madonna",
    });
  });

  it("trims leading/trailing whitespace", () => {
    expect(parseName("  John   Doe  ")).toEqual({
      givenName: "John",
      familyName: "Doe",
    });
  });

  it("collapses multiple spaces between name parts", () => {
    expect(parseName("John    Doe")).toEqual({
      givenName: "John",
      familyName: "Doe",
    });
  });
});

describe("extractUsername", () => {
  it("removes @google.com suffix", () => {
    expect(extractUsername("alice@google.com")).toBe("alice");
  });

  it("handles complex usernames", () => {
    expect(extractUsername("alice.bob+test@google.com")).toBe("alice.bob+test");
  });
});

describe("generatePassword", () => {
  it("returns a 16-character string", () => {
    const pw = generatePassword();
    expect(pw).toHaveLength(16);
  });

  it("generates different passwords on each call", () => {
    const passwords = new Set(
      Array.from({ length: 10 }, () => generatePassword())
    );
    // With 16 chars from 72-char alphabet, collisions are astronomically unlikely
    expect(passwords.size).toBe(10);
  });

  it("only contains characters from the allowed set", () => {
    const allowed =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    const pw = generatePassword();
    for (const char of pw) {
      expect(allowed).toContain(char);
    }
  });
});

describe("EnrollmentSchema", () => {
  it("accepts valid enrollment data", () => {
    const result = EnrollmentSchema.safeParse({
      name: "John Doe",
      email: "john@google.com",
      password: "secret123",
    });
    expect(result.success).toBe(true);
  });

  it("lowercases email", () => {
    const result = EnrollmentSchema.safeParse({
      name: "John",
      email: "ALICE@google.com",
      password: "secret",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("alice@google.com");
    }
  });

  it("trims name whitespace", () => {
    const result = EnrollmentSchema.safeParse({
      name: "  John Doe  ",
      email: "john@google.com",
      password: "secret",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("John Doe");
    }
  });

  it("rejects non-google.com email", () => {
    const result = EnrollmentSchema.safeParse({
      name: "John",
      email: "john@example.com",
      password: "secret",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = EnrollmentSchema.safeParse({
      name: "",
      email: "john@google.com",
      password: "secret",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = EnrollmentSchema.safeParse({
      name: "John",
      email: "john@google.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = EnrollmentSchema.safeParse({
      name: "John",
      email: "not-an-email",
      password: "secret",
    });
    expect(result.success).toBe(false);
  });
});
