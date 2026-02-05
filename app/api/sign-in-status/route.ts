/**
 * API route that returns the current user's authentication status.
 * Supports both OAuth sessions and default user mode.
 */

import { auth } from "@/lib/auth";
import { getDefaultUserEmail, isDefaultUserEnabled } from "@/lib/default-user";

/**
 * Token info response from Google's tokeninfo endpoint.
 */
interface GoogleTokenInfo {
  expires_in?: string;
  access_type?: string;
  scope?: string;
  email?: string;
  email_verified?: string;
  error_description?: string;
}

/**
 * User identity information.
 */
interface UserInfo {
  name: string | null;
  email: string | null;
  image: string | null;
}

/**
 * Full sign-in status response shape.
 */
interface SignInStatusResponse {
  authenticated: boolean;
  isDefaultUser?: boolean;
  user?: UserInfo;
  token?: {
    expiresIn: number;
    expiresAt: string;
    scopes: string[];
  };
  error?: string;
}

/**
 * Session user shape from BetterAuth.
 */
interface SessionUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

/**
 * Fetch token info from Google's tokeninfo endpoint.
 */
async function getGoogleTokenInfo(
  accessToken: string
): Promise<GoogleTokenInfo | null> {
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
    );
    const data = (await response.json()) as GoogleTokenInfo;
    return data;
  } catch {
    return null;
  }
}

/**
 * Build a UserInfo object from a session user.
 */
function buildUserInfo(user: SessionUser): UserInfo {
  return {
    name: user.name ?? null,
    email: user.email ?? null,
    image: user.image ?? null,
  };
}

/**
 * Build an unauthenticated response.
 */
function buildNoSessionResponse(): SignInStatusResponse {
  return { authenticated: false, error: "No active session" };
}

/**
 * Build an authenticated response with a token error.
 */
function buildAuthenticatedErrorResponse(
  user: UserInfo,
  error: string
): SignInStatusResponse {
  return { authenticated: true, user, error };
}

/**
 * Build a successful authenticated response with token details.
 */
function buildSuccessResponse(
  user: UserInfo,
  tokenInfo: GoogleTokenInfo
): SignInStatusResponse {
  const expiresIn = Number.parseInt(tokenInfo.expires_in ?? "0", 10);
  return {
    authenticated: true,
    user,
    token: {
      expiresIn,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      scopes: tokenInfo.scope?.split(" ") ?? [],
    },
  };
}

/**
 * Build a response for the default user with a long-lived synthetic token.
 * Service account tokens are managed separately so we report a stable status.
 */
function buildDefaultUserResponse(email: string): SignInStatusResponse {
  const expiresIn = 12 * 60 * 60;
  return {
    authenticated: true,
    isDefaultUser: true,
    user: {
      name: "Default Admin",
      email,
      image: null,
    },
    token: {
      expiresIn,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      scopes: ["service-account"],
    },
  };
}

/**
 * Validate a Google access token and build the status response.
 */
async function validateAndBuildTokenResponse(
  accessToken: string,
  userInfo: UserInfo
): Promise<SignInStatusResponse> {
  const tokenInfo = await getGoogleTokenInfo(accessToken);
  if (!tokenInfo || tokenInfo.error_description) {
    return buildAuthenticatedErrorResponse(
      userInfo,
      tokenInfo?.error_description ?? "Token validation failed"
    );
  }
  return buildSuccessResponse(userInfo, tokenInfo);
}

/**
 * Process the sign-in status for a request. Checks for an active BetterAuth
 * session first, then falls back to default user mode if enabled.
 */
async function processSignInStatus(
  req: Request
): Promise<SignInStatusResponse> {
  const session = await auth.api.getSession({ headers: req.headers });

  if (session?.user) {
    const userInfo = buildUserInfo(session.user);
    const tokenResponse = await auth.api.getAccessToken({
      body: { providerId: "google" },
      headers: req.headers,
    });

    if (!tokenResponse?.accessToken) {
      return buildAuthenticatedErrorResponse(
        userInfo,
        "No access token available"
      );
    }

    return validateAndBuildTokenResponse(tokenResponse.accessToken, userInfo);
  }

  // No BetterAuth session - check for default user mode
  if (isDefaultUserEnabled()) {
    const email = getDefaultUserEmail();
    if (email) {
      return buildDefaultUserResponse(email);
    }
  }

  return buildNoSessionResponse();
}

/**
 * GET handler for sign-in status checks.
 */
export async function GET(req: Request): Promise<Response> {
  try {
    return Response.json(await processSignInStatus(req));
  } catch (error) {
    console.log(
      "[sign-in-status] Error:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return Response.json(
      {
        authenticated: false,
        error: "Failed to check sign-in status",
      } satisfies SignInStatusResponse,
      { status: 500 }
    );
  }
}
