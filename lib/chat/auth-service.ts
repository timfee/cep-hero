import { auth } from "@/lib/auth";

const EVAL_TEST_MODE_ENABLED = process.env.EVAL_TEST_MODE === "1";

export type AuthResult =
  | {
      status: "success";
      session: any;
      accessToken: string;
      isTestMode: boolean;
    }
  | { status: "unauthorized"; error: string }
  | { status: "test_mode_response" };

/**
 * Authenticate an incoming request for the chat API.
 * Handles both standard session-based auth and special test-mode bypasses.
 *
 * @param req - The incoming request object.
 * @returns An AuthResult object indicating success, failure, or a test mode intercept.
 */
export async function authenticateRequest(req: Request): Promise<AuthResult> {
  const isTestBypass = req.headers.get("x-test-bypass") === "1";
  const isEvalTestModeRequest = req.headers.get("x-eval-test-mode") === "1";

  const isEvalTestMode =
    EVAL_TEST_MODE_ENABLED && (isEvalTestModeRequest || isTestBypass);

  // If in eval mode without explicit bypass, we might still return the synthetic response
  if (isEvalTestMode && !isTestBypass) {
    return { status: "test_mode_response" };
  }

  // Retrieve session (mocked if bypassing)
  const session = isTestBypass
    ? { user: { id: "test" } }
    : await auth.api.getSession({ headers: req.headers });

  if (!session) {
    return {
      status: "unauthorized",
      error: "Unauthorized. Please sign in to use CEP tools.",
    };
  }

  // Retrieve access token
  let accessToken: string | undefined;

  if (isTestBypass) {
    accessToken = "test-token";
  } else {
    try {
      const tokenResponse = await auth.api.getAccessToken({
        body: { providerId: "google" },
        headers: req.headers,
      });

      accessToken = tokenResponse?.accessToken;
    } catch {
      if (EVAL_TEST_MODE_ENABLED) {
        return { status: "test_mode_response" };
      }

      return {
        status: "unauthorized",
        error: "Failed to fetch Google access token",
      };
    }
  }

  if (!accessToken) {
    if (EVAL_TEST_MODE_ENABLED) {
      return { status: "test_mode_response" };
    }

    return {
      status: "unauthorized",
      error: "Missing Google access token. Please re-authenticate.",
    };
  }

  return {
    status: "success",
    session,
    accessToken,
    isTestMode: isEvalTestMode,
  };
}
