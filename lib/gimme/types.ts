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
 * Parsed name components for Google Workspace user creation.
 */
export interface ParsedName {
  givenName: string;
  familyName: string;
}
