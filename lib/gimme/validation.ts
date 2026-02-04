/**
 * Validation schemas and utilities for gimme self-enrollment.
 */

import { z } from "zod";

import { ALLOWED_EMAIL_SUFFIX, MAX_NAME_LENGTH } from "./constants";
import { type ParsedName } from "./types";

/**
 * Schema for enrollment form data.
 */
export const EnrollmentSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(MAX_NAME_LENGTH, `Name must be ${MAX_NAME_LENGTH} characters or less`)
    .transform((val) => val.trim()),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email format")
    .refine((val) => val.toLowerCase().endsWith(ALLOWED_EMAIL_SUFFIX), {
      message: "Email must end with @google.com",
    })
    .transform((val) => val.toLowerCase().trim()),
  password: z.string().min(1, "Enrollment password is required"),
});

export type EnrollmentInput = z.infer<typeof EnrollmentSchema>;

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
 * Extract username from validated Google email.
 */
export function extractUsername(email: string): string {
  return email.replace(ALLOWED_EMAIL_SUFFIX, "");
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
