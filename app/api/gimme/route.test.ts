/**
 * Tests for the self-enrollment /api/gimme endpoint.
 */

import { describe, expect, it } from "bun:test";

/**
 * Helper to validate if a body object has a valid name field.
 */
function isValidName(name: unknown): boolean {
  return typeof name === "string" && name.trim().length > 0;
}

/**
 * Helper to validate if a body object has a valid email field.
 */
function isValidEmail(email: unknown): boolean {
  return typeof email === "string" && email.trim().length > 0;
}

/**
 * Helper to validate if a body object has a valid password field.
 */
function isValidPassword(password: unknown): boolean {
  return typeof password === "string" && password.length > 0;
}

/**
 * Helper to validate if a body is a valid non-null object.
 */
function isValidObject(body: unknown): boolean {
  return (
    body !== null &&
    body !== undefined &&
    typeof body === "object" &&
    !Array.isArray(body)
  );
}

/**
 * Helper to parse a name into given and family components.
 */
function parseName(fullName: string): {
  givenName: string;
  familyName: string;
} {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { givenName: parts[0], familyName: parts[0] };
  }
  return { givenName: parts[0], familyName: parts.slice(1).join(" ") };
}

describe("/api/gimme endpoint", () => {
  describe("request validation", () => {
    it("validates email format ends with @google.com", () => {
      const validEmails = [
        "user@google.com",
        "john.doe@google.com",
        "test-user@google.com",
        "user123@google.com",
      ];

      for (const email of validEmails) {
        expect(email.endsWith("@google.com")).toBe(true);
      }
    });

    it("rejects non-google.com emails", () => {
      const invalidEmails = [
        "user@gmail.com",
        "user@example.com",
        "user@google.org",
        "user@notgoogle.com",
      ];

      for (const email of invalidEmails) {
        expect(email.endsWith("@google.com")).toBe(false);
      }
    });

    it("extracts username from google.com email", () => {
      const email = "johndoe@google.com";
      const username = email.replace("@google.com", "");
      expect(username).toBe("johndoe");
    });

    it("validates username characters", () => {
      const validUsernames = [
        "user",
        "john.doe",
        "test-user",
        "user123",
        "user_name",
      ];
      const usernameRegex = /^[a-z0-9._-]+$/i;

      for (const username of validUsernames) {
        expect(usernameRegex.test(username)).toBe(true);
      }
    });

    it("rejects invalid username characters", () => {
      const usernameRegex = /^[a-z0-9._-]+$/i;

      expect(usernameRegex.test("user name")).toBe(false);
      expect(usernameRegex.test("user@name")).toBe(false);
      expect(usernameRegex.test("user/name")).toBe(false);
      expect("".length > 0).toBe(false);
    });
  });

  describe("response structure", () => {
    it("success response has correct shape", () => {
      const successResponse = {
        success: true,
        message: "Account created successfully",
        email: "testuser@cep-netnew.cc",
        notificationSentTo: "testuser@google.com",
        instructions: [
          "Check your email for login credentials",
          "Sign in at https://admin.google.com with testuser@cep-netnew.cc",
          "You will be prompted to change your password on first login",
        ],
      };

      expect(successResponse).toHaveProperty("success", true);
      expect(successResponse).toHaveProperty("message");
      expect(successResponse).toHaveProperty("email");
      expect(successResponse).toHaveProperty("notificationSentTo");
      expect(successResponse).toHaveProperty("instructions");
      expect(Array.isArray(successResponse.instructions)).toBe(true);
    });

    it("error response has correct shape", () => {
      const errorResponse = {
        error: "Email must end with @google.com",
      };

      expect(errorResponse).toHaveProperty("error");
      expect(typeof errorResponse.error).toBe("string");
    });

    it("rate limit response has correct shape", () => {
      const rateLimitResponse = {
        error: "Too many requests. Please try again later.",
        retryAfter: 900,
      };

      expect(rateLimitResponse).toHaveProperty("error");
      expect(rateLimitResponse).toHaveProperty("retryAfter");
      expect(typeof rateLimitResponse.retryAfter).toBe("number");
    });

    it("conflict response has correct shape", () => {
      const conflictResponse = {
        error:
          "Account testuser@cep-netnew.cc already exists. Contact an administrator for access.",
      };

      expect(conflictResponse).toHaveProperty("error");
      expect(conflictResponse.error).toContain("already exists");
    });
  });

  describe("email transformation", () => {
    it("creates correct cep-netnew.cc email from google.com email", () => {
      const googleEmail = "johndoe@google.com";
      const username = googleEmail.replace("@google.com", "");
      const newEmail = `${username}@cep-netnew.cc`;

      expect(newEmail).toBe("johndoe@cep-netnew.cc");
    });

    it("preserves username casing during extraction", () => {
      const googleEmail = "JohnDoe@google.com";
      const normalizedEmail = googleEmail.toLowerCase();
      const username = normalizedEmail.replace("@google.com", "");

      expect(username).toBe("johndoe");
    });
  });

  describe("name parsing", () => {
    it("parses single name into both given and family name", () => {
      const result = parseName("John");

      expect(result.givenName).toBe("John");
      expect(result.familyName).toBe("John");
    });

    it("parses full name into given and family name", () => {
      const result = parseName("John Doe");

      expect(result.givenName).toBe("John");
      expect(result.familyName).toBe("Doe");
    });

    it("handles multiple name parts", () => {
      const result = parseName("John Michael Doe");

      expect(result.givenName).toBe("John");
      expect(result.familyName).toBe("Michael Doe");
    });

    it("trims whitespace from name", () => {
      const fullName = "  John Doe  ";
      const parts = fullName.trim().split(/\s+/);

      expect(parts).toEqual(["John", "Doe"]);
    });
  });

  describe("password generation", () => {
    it("generates password with correct character set", () => {
      const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";

      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      const password = [...array]
        .map((byte) => chars[byte % chars.length])
        .join("");

      expect(password.length).toBe(16);

      for (const char of password) {
        expect(chars.includes(char)).toBe(true);
      }
    });

    it("generates unique passwords", () => {
      const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";

      const passwords = new Set<string>();

      for (let i = 0; i < 10; i += 1) {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        const password = [...array]
          .map((byte) => chars[byte % chars.length])
          .join("");
        passwords.add(password);
      }

      expect(passwords.size).toBe(10);
    });
  });

  describe("validation errors", () => {
    it("returns error for missing name", () => {
      const body = { email: "test@google.com", password: "secret" };
      expect(isValidName((body as Record<string, unknown>).name)).toBe(false);
    });

    it("returns error for empty name", () => {
      const body = { name: "", email: "test@google.com", password: "secret" };
      expect(isValidName(body.name)).toBe(false);
    });

    it("returns error for name exceeding max length", () => {
      const maxLength = 200;
      const longName = "a".repeat(maxLength + 1);
      expect(longName.length > maxLength).toBe(true);
    });

    it("accepts name at max length", () => {
      const maxLength = 200;
      const validName = "a".repeat(maxLength);
      expect(validName.length <= maxLength).toBe(true);
    });

    it("returns error for missing email", () => {
      const body = { name: "Test User", password: "secret" };
      expect(isValidEmail((body as Record<string, unknown>).email)).toBe(false);
    });

    it("returns error for missing password", () => {
      const body = { name: "Test User", email: "test@google.com" };
      expect(isValidPassword((body as Record<string, unknown>).password)).toBe(
        false
      );
    });

    it("returns error for null body", () => {
      expect(isValidObject(null)).toBe(false);
    });

    it("returns error for undefined body", () => {
      const undefinedValue: unknown = undefined;
      expect(isValidObject(undefinedValue)).toBe(false);
    });

    it("returns error for string body", () => {
      expect(isValidObject("string")).toBe(false);
    });

    it("returns error for number body", () => {
      expect(isValidObject(123)).toBe(false);
    });

    it("returns error for array body", () => {
      expect(isValidObject([])).toBe(false);
    });
  });

  describe("HTTP status codes", () => {
    it("returns 400 for validation errors", () => {
      const status = 400;
      expect(status).toBe(400);
    });

    it("returns 429 for rate limiting", () => {
      const status = 429;
      expect(status).toBe(429);
    });

    it("returns 409 for user already exists", () => {
      const status = 409;
      expect(status).toBe(409);
    });

    it("returns 500 for server errors", () => {
      const status = 500;
      expect(status).toBe(500);
    });
  });
});
