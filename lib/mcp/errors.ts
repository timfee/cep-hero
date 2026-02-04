/**
 * Standardized error handling and formatting for API operations.
 * Provides unified ApiResult<T> discriminated union for consistent error handling.
 */

import { StatusCodes } from "http-status-codes";

/**
 * Discriminated union for API results. Use `success` field as the discriminant.
 * This replaces the previous pattern of checking `"error" in result`.
 */
export type ApiResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: string;
      suggestion: string;
      requiresReauth: boolean;
    };

/**
 * Type guard for successful API results.
 */
export function isSuccess<T>(
  result: ApiResult<T>
): result is { success: true; data: T } {
  return result.success;
}

/**
 * Type guard for failed API results.
 */
export function isError<T>(result: ApiResult<T>): result is {
  success: false;
  error: string;
  suggestion: string;
  requiresReauth: boolean;
} {
  return !result.success;
}

/**
 * Wraps a successful value in an ApiResult.
 */
export function ok<T>(data: T): ApiResult<T> {
  return { success: true, data };
}

/**
 * Wraps an error in an ApiResult.
 */
export function err<T>(
  error: string,
  suggestion: string,
  requiresReauth = false
): ApiResult<T> {
  return { success: false, error, suggestion, requiresReauth };
}

/**
 * Standardized API error response shape.
 * Used by all executor result types as the error branch of their union.
 */
export interface ApiErrorResponse {
  error: string;
  suggestion: string;
  requiresReauth: boolean;
}

/**
 * Type guard for checking if a result is an API error response.
 * Works with any result type that uses the ApiErrorResponse shape.
 */
export function isApiError<T>(
  result: T | ApiErrorResponse
): result is ApiErrorResponse {
  return (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    typeof (result as ApiErrorResponse).error === "string"
  );
}

/**
 * Context for API operations, used for error messages.
 */
interface ApiContext {
  name: string;
  defaultSuggestion: string;
}

/**
 * Registry of API contexts with their default error suggestions.
 */
const API_CONTEXTS = {
  "chrome-events": {
    name: "Chrome Events",
    defaultSuggestion:
      "Ensure the 'Admin SDK' API is enabled in GCP and the user has 'Reports' privileges.",
  },
  "dlp-rules": {
    name: "DLP Rules",
    defaultSuggestion:
      "Check 'Cloud Identity API' enablement and DLP Read permissions.",
  },
  "org-units": {
    name: "Org Units",
    defaultSuggestion:
      "Check 'Admin SDK' enablement and Org Unit Read permissions.",
  },
  "enroll-browser": {
    name: "Browser Enrollment",
    defaultSuggestion:
      "Ensure 'Chrome Browser Cloud Management API' is enabled and caller has Chrome policy admin rights.",
  },
  "connector-config": {
    name: "Connector Config",
    defaultSuggestion:
      "Check Chrome Policy API permissions and policy schema access.",
  },
} as const satisfies Record<string, ApiContext>;

/**
 * Valid API context identifiers for error handling.
 */
export type ApiContextKey = keyof typeof API_CONTEXTS;

const SESSION_EXPIRED_SUGGESTION =
  "Your session has expired. Please sign in again to continue.";

/**
 * Checks if an error requires re-authentication based on HTTP status code.
 */
function requiresReauthentication(code: number | string | undefined) {
  const numericCode =
    typeof code === "string" ? Number.parseInt(code, 10) : code;
  return (
    numericCode === StatusCodes.UNAUTHORIZED ||
    numericCode === StatusCodes.FORBIDDEN
  );
}

/**
 * Type guard for checking if a value is an error-like object.
 */
function isErrorObject(error: unknown): error is Record<string, unknown> {
  return error !== null && typeof error === "object";
}

/**
 * Extracts the error code from an error object.
 */
function extractErrorCode(error: unknown) {
  if (!isErrorObject(error)) {
    return;
  }
  const { code } = error;
  if (typeof code === "number" || typeof code === "string") {
    return code;
  }
}

/**
 * Extracts the error message from an error object.
 */
function extractErrorMessage(error: unknown) {
  if (!isErrorObject(error)) {
    return;
  }
  const { message } = error;
  return typeof message === "string" ? message : undefined;
}

/**
 * Normalizes error details from API exceptions.
 */
export function getErrorDetails(error: unknown) {
  if (!isErrorObject(error)) {
    return {};
  }

  return {
    code: extractErrorCode(error),
    message: extractErrorMessage(error),
    errors: error.errors,
  };
}

/**
 * Extracts a readable message from unknown errors.
 */
export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  const message = extractErrorMessage(error);
  return message ?? "Unknown error";
}

/**
 * Creates a standardized API error response with reauth detection.
 */
export function createApiError(error: unknown, contextKey: ApiContextKey) {
  const { code, message } = getErrorDetails(error);
  const context = API_CONTEXTS[contextKey];
  const requiresReauth = requiresReauthentication(code);

  return {
    error: message ?? "Unknown error",
    suggestion: requiresReauth
      ? SESSION_EXPIRED_SUGGESTION
      : context.defaultSuggestion,
    requiresReauth,
  };
}

/**
 * Logs structured API errors with consistent formatting.
 * Consolidates the repeated logging pattern across executor files.
 */
export function logApiError(tag: string, error: unknown) {
  const details = getErrorDetails(error);
  console.log(`[${tag}] error`, JSON.stringify(details));
}

/**
 * Logs structured API responses with consistent formatting.
 */
export function logApiResponse(tag: string, data: Record<string, unknown>) {
  console.log(`[${tag}] response`, JSON.stringify(data));
}

/**
 * Logs structured API requests with consistent formatting.
 */
export function logApiRequest(tag: string, data?: Record<string, unknown>) {
  if (data) {
    console.log(`[${tag}] request`, data);
  } else {
    console.log(`[${tag}] request`);
  }
}
