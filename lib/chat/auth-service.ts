/**
 * Authentication service for validating chat API requests.
 */

import { auth } from "@/lib/auth";

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
 * Retrieve the session from Better Auth or return a test stub.
 */
async function getSession(req: Request, isTestBypass: boolean) {
  if (isTestBypass) {
    return { user: { id: "test" } };
  }
  const session = await auth.api.getSession({ headers: req.headers });
  return session;
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
 * Get access token, returning test token in bypass mode.
 */
async function getAccessToken(
  req: Request,
  isTestBypass: boolean
): Promise<AccessTokenResult> {
  if (isTestBypass) {
    return { type: "success", token: "test-token" };
  }
  const result = await fetchTokenFromApi(req);
  return result;
}

/**
 * Convert token result to appropriate auth response or extract token.
 */
function handleTokenResult(
  tokenResult: AccessTokenResult
): AuthResult | { token: string } {
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
 * Validate that a session exists and return error if missing.
 */
function validateSession(session: unknown): AuthResult | null {
  if (session === null || session === undefined) {
    return {
      status: "unauthorized",
      error: "Unauthorized. Please sign in to use CEP tools.",
    };
  }
  return null;
}

/**
 * Build a successful auth result with session and token.
 */
function buildSuccessResult(
  session: unknown,
  token: string,
  isTestMode: boolean
): AuthResult {
  return {
    status: "success",
    session,
    accessToken: token,
    isTestMode,
  };
}

/**
 * Process token retrieval and build final auth result.
 */
async function processTokenAndBuildResult(
  req: Request,
  session: unknown,
  isTestBypass: boolean,
  isEvalTestMode: boolean
): Promise<AuthResult> {
  const tokenResult = await getAccessToken(req, isTestBypass);
  const handled = handleTokenResult(tokenResult);
  if ("status" in handled) {
    return handled;
  }
  return buildSuccessResult(session, handled.token, isEvalTestMode);
}

/**
 * Authenticate an incoming request for the chat API.
 * Handles both standard session-based auth and special test-mode bypasses.
 */
export async function authenticateRequest(req: Request): Promise<AuthResult> {
  const { isTestBypass, isEvalTestMode } = buildAuthContext(req);

  if (isEvalTestMode && !isTestBypass) {
    return { status: "test_mode_response" };
  }

  const session = await getSession(req, isTestBypass);
  const sessionError = validateSession(session);
  if (sessionError) {
    return sessionError;
  }

  return processTokenAndBuildResult(req, session, isTestBypass, isEvalTestMode);
}
