import { auth } from "@/lib/auth";

const EVAL_TEST_MODE_ENABLED = process.env.EVAL_TEST_MODE === "1";

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

function buildAuthContext(req: Request): AuthContext {
  const isTestBypass = req.headers.get("x-test-bypass") === "1";
  const isEvalTestModeRequest = req.headers.get("x-eval-test-mode") === "1";
  const isEvalTestMode =
    EVAL_TEST_MODE_ENABLED && (isEvalTestModeRequest || isTestBypass);
  return { isTestBypass, isEvalTestMode };
}

async function getSession(
  req: Request,
  isTestBypass: boolean
): Promise<unknown> {
  if (isTestBypass) {
    return { user: { id: "test" } };
  }
  const session = await auth.api.getSession({ headers: req.headers });
  return session;
}

async function getAccessToken(
  req: Request,
  isTestBypass: boolean
): Promise<AccessTokenResult> {
  if (isTestBypass) {
    return { type: "success", token: "test-token" };
  }
  try {
    const tokenResponse = await auth.api.getAccessToken({
      body: { providerId: "google" },
      headers: req.headers,
    });
    const token = tokenResponse?.accessToken;
    if (token) {
      return { type: "success", token };
    }
    return { type: "undefined" };
  } catch {
    if (EVAL_TEST_MODE_ENABLED) {
      return { type: "test_mode_fallback" };
    }
    return { type: "error" };
  }
}

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
 * Authenticate an incoming request for the chat API.
 * Handles both standard session-based auth and special test-mode bypasses.
 */
export async function authenticateRequest(req: Request): Promise<AuthResult> {
  const { isTestBypass, isEvalTestMode } = buildAuthContext(req);

  if (isEvalTestMode && !isTestBypass) {
    return { status: "test_mode_response" };
  }

  const session = await getSession(req, isTestBypass);
  if (session === null || session === undefined) {
    return {
      status: "unauthorized",
      error: "Unauthorized. Please sign in to use CEP tools.",
    };
  }

  const tokenResult = await getAccessToken(req, isTestBypass);
  const handled = handleTokenResult(tokenResult);
  if ("status" in handled) {
    return handled;
  }

  return {
    status: "success",
    session,
    accessToken: handled.token,
    isTestMode: isEvalTestMode,
  };
}
