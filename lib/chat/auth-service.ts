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

export async function authenticateRequest(req: Request): Promise<AuthResult> {
  const isTestBypass = req.headers.get("x-test-bypass") === "1";
  const isEvalTestModeRequest = req.headers.get("x-eval-test-mode") === "1";
  const isEvalTestMode =
    EVAL_TEST_MODE_ENABLED && (isEvalTestModeRequest || isTestBypass);

  if (isEvalTestMode && !isTestBypass) {
    // If it's just eval mode but not an explicit bypass, we might still want to return the test response
    // immediately if that was the original logic.
    // Original logic: if (isEvalTestMode) { return createTestModeResponse(); }
    return { status: "test_mode_response" };
  }

  const session = isTestBypass
    ? { user: { id: "test" } }
    : await auth.api.getSession({ headers: req.headers });

  if (!session) {
    return {
      status: "unauthorized",
      error: "Unauthorized. Please sign in to use CEP tools.",
    };
  }

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

/**
 * Return a structured synthetic response for eval test mode.
 */
export function createTestModeResponse(): Response {
  const diagnosis = "Synthetic diagnosis for eval test mode.";
  const nextSteps = [
    "Review fixture context",
    "Compare output to expected schema",
  ];
  const hypotheses = [
    {
      cause: "Synthetic placeholder hypothesis",
      confidence: 0.2,
    },
  ];
  const planSteps = ["Check fixture context", "Generate structured response"];
  const missingQuestions = [
    {
      question: "What changed most recently?",
      why: "Identify the most likely regression window",
    },
  ];
  const evidence = {
    source: "synthetic",
    planSteps,
    missingQuestions,
  };

  return new Response(
    JSON.stringify({
      diagnosis,
      nextSteps,
      hypotheses,
      planSteps,
      missingQuestions,
      evidence,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
