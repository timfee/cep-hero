/**
 * Shared types for the gimme self-enrollment feature.
 */

/**
 * Result type for enrollment operations.
 */
export type EnrollmentResult =
  | {
      success: true;
      email: string;
      notificationSentTo: string;
    }
  | {
      success: false;
      error: string;
    };

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
