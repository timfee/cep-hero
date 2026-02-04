/**
 * Shared types for the gimme self-enrollment feature.
 */

/**
 * Result type for enrollment operations.
 * Basic validation errors (missing fields, invalid format) include an error.
 * Once validation passes, notificationSentTo is set and details are sent via email.
 */
export interface EnrollmentResult {
  notificationSentTo: string;
  error?: string;
}

/**
 * Parsed name components.
 */
export interface ParsedName {
  givenName: string;
  familyName: string;
}

/**
 * Validation result with extracted data.
 */
export type ValidationResult =
  | { valid: true; username: string; name: string }
  | { valid: false; error: string };
