/**
 * Authentication service for validating chat API requests.
 * Supports OAuth sessions, test-mode bypasses, and default user mode.
 */

import { auth } from "@/lib/auth";
import {
  getDefaultUserAccessToken,
  isDefaultUserEnabled,
} from "@/lib/default-user";

const EVAL_TEST_MODE_ENABLED = process.env.EVAL_TEST_MODE === "1";

/**
 * Result from authenticating a chat API request.
 */
export type AuthResult =
  | {
      status: "success";
      session: unknown;
      accessToken: string;
      isTestMode: boolean;
    }
  | { status: "unauthorized"; error: string }
  | { status: "test_mode_response" };

interface AuthContext {
  isTestBypass: boolean;
  isEvalTestMode: boolean;
}

type AccessTokenResult =
  | { type: "success"; token: string }
  | { type: "undefined" }
  | { type: "error" }
  | { type: "test_mode_fallback" };

/**
 * Extract authentication context flags from request headers.
 */
function buildAuthContext(req: Request): AuthContext {
  const isTestBypass = req.headers.get("x-test-bypass") === "1";
  const isEvalTestModeRequest = req.headers.get("x-eval-test-mode") === "1";
  const isEvalTestMode =
    EVAL_TEST_MODE_ENABLED && (isEvalTestModeRequest || isTestBypass);
  return { isTestBypass, isEvalTestMode };
}

/**
 * Retrieve the session from Better Auth, a test stub, or a default user stub.
 */
async function getSession(req: Request, isTestBypass: boolean) {
  if (isTestBypass) {
    return { user: { id: "test" } };
  }

  const session = await auth.api.getSession({ headers: req.headers });
  if (session) {
    return session;
  }

  // Fall back to default user mode when no OAuth session exists
  if (isDefaultUserEnabled()) {
    return { user: { id: "default-user" } };
  }

  return null;
}

/**
 * Fetch Google OAuth access token from Better Auth API.
 */
async function fetchTokenFromApi(req: Request): Promise<AccessTokenResult> {
  try {
    const tokenResponse = await auth.api.getAccessToken({
      body: { providerId: "google" },
      headers: req.headers,
    });
    const token = tokenResponse?.accessToken;
    return token ? { type: "success", token } : { type: "undefined" };
  } catch {
    return EVAL_TEST_MODE_ENABLED
      ? { type: "test_mode_fallback" }
      : { type: "error" };
  }
}

/**
 * Get access token from test bypass, OAuth session, or default user service account.
 */
async function getAccessToken(
  req: Request,
  isTestBypass: boolean
): Promise<AccessTokenResult> {
  if (isTestBypass) {
    // Prefer real service account token for E2E tests with live API access
    if (isDefaultUserEnabled()) {
      const defaultToken = await getDefaultUserAccessToken();
      if (defaultToken) {
        return { type: "success", token: defaultToken };
      }
    }
    return { type: "success", token: "test-token" };
  }

  const result = await fetchTokenFromApi(req);
  if (result.type === "success") {
    return result;
  }

  // Fall back to service account token when OAuth token is unavailable
  if (isDefaultUserEnabled()) {
    const defaultToken = await getDefaultUserAccessToken();
    if (defaultToken) {
      return { type: "success", token: defaultToken };
    }
  }

  return result;
}

type TokenHandlerResult = AuthResult | { token: string };

/**
 * Type guard for auth results from token handling.
 */
function isAuthResult(result: TokenHandlerResult): result is AuthResult {
  return "status" in result;
}

/**
 * Convert token result to appropriate auth response or extract token.
 */
function handleTokenResult(tokenResult: AccessTokenResult): TokenHandlerResult {
  if (tokenResult.type === "success") {
    return { token: tokenResult.token };
  }
  if (tokenResult.type === "test_mode_fallback") {
    return { status: "test_mode_response" };
  }
  if (tokenResult.type === "error") {
    return {
      status: "unauthorized",
      error: "Failed to fetch Google access token",
    };
  }
  if (EVAL_TEST_MODE_ENABLED) {
    return { status: "test_mode_response" };
  }
  return {
    status: "unauthorized",
    error: "Missing Google access token. Please re-authenticate.",
  };
}

/**
 * Authenticate an incoming request for the chat API.
 * Handles standard session-based auth, test-mode bypasses, and default user mode.
 */
export async function authenticateRequest(req: Request): Promise<AuthResult> {
  const { isTestBypass, isEvalTestMode } = buildAuthContext(req);

  if (isEvalTestMode && !isTestBypass) {
    return { status: "test_mode_response" };
  }

  const session = await getSession(req, isTestBypass);
  if (!session) {
    return {
      status: "unauthorized",
      error: "Unauthorized. Please sign in to use CEP tools.",
    };
  }

  const tokenResult = await getAccessToken(req, isTestBypass);
  const handled = handleTokenResult(tokenResult);
  if (isAuthResult(handled)) {
    return handled;
  }

  return {
    status: "success",
    session,
    accessToken: handled.token,
    isTestMode: isEvalTestMode,
  };
}
