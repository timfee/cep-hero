/**
 * Validation utilities for gimme self-enrollment.
 */

import { timingSafeEqual } from "@/lib/rate-limit";

import { ALLOWED_EMAIL_SUFFIX, MAX_NAME_LENGTH } from "./constants";
import { type ParsedName, type ValidationResult } from "./types";

/**
 * Strip surrounding quotes from environment variable values.
 */
export function stripQuotes(value: string | undefined): string | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  return value.replaceAll(/^['"]|['"]$/g, "");
}

/**
 * Parse name into given and family name components.
 */
export function parseName(fullName: string): ParsedName {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { givenName: parts[0], familyName: parts[0] };
  }
  return { givenName: parts[0], familyName: parts.slice(1).join(" ") };
}

/**
 * Validate name field with length limits.
 */
export function validateName(
  name: unknown
): { valid: false; error: string } | { valid: true; name: string } {
  if (typeof name !== "string" || name.trim().length === 0) {
    return { valid: false, error: "Name is required" };
  }

  const trimmedName = name.trim();
  if (trimmedName.length > MAX_NAME_LENGTH) {
    return {
      valid: false,
      error: `Name must be ${MAX_NAME_LENGTH} characters or less`,
    };
  }

  return { valid: true, name: trimmedName };
}

/**
 * Validate email field and extract username.
 */
export function validateEmail(
  email: unknown
): { valid: false; error: string } | { valid: true; username: string } {
  if (typeof email !== "string" || email.trim().length === 0) {
    return { valid: false, error: "Email is required" };
  }

  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail.endsWith(ALLOWED_EMAIL_SUFFIX)) {
    return { valid: false, error: "Email must end with @google.com" };
  }

  const username = normalizedEmail.replace(ALLOWED_EMAIL_SUFFIX, "");
  if (username.length === 0 || !/^[a-z0-9._-]+$/i.test(username)) {
    return { valid: false, error: "Invalid email format" };
  }

  return { valid: true, username };
}

/**
 * Validate enrollment password using timing-safe comparison.
 */
export function validateEnrollmentPassword(
  password: unknown
): { valid: false; error: string } | { valid: true } {
  if (typeof password !== "string" || password.length === 0) {
    return { valid: false, error: "Password is required" };
  }

  const enrollmentPassword = stripQuotes(process.env.SELF_ENROLLMENT_PASSWORD);
  if (!enrollmentPassword) {
    console.error("[gimme] SELF_ENROLLMENT_PASSWORD not configured");
    return { valid: false, error: "Self-enrollment is not configured" };
  }

  if (!timingSafeEqual(password, enrollmentPassword)) {
    return { valid: false, error: "Invalid enrollment password" };
  }

  return { valid: true };
}

/**
 * Validate complete enrollment request.
 */
export function validateEnrollmentRequest(body: unknown): ValidationResult {
  if (
    body === null ||
    body === undefined ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return { valid: false, error: "Invalid request body" };
  }

  const { name, email, password } = body as Record<string, unknown>;

  const nameResult = validateName(name);
  if (!nameResult.valid) {
    return nameResult;
  }

  const emailResult = validateEmail(email);
  if (!emailResult.valid) {
    return emailResult;
  }

  const passwordResult = validateEnrollmentPassword(password);
  if (!passwordResult.valid) {
    return passwordResult;
  }

  return { valid: true, username: emailResult.username, name: nameResult.name };
}

/**
 * Generate a secure random password.
 */
export function generatePassword(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return [...array].map((byte) => chars[byte % chars.length]).join("");
}
