import { auth } from "@/lib/auth";

interface GoogleTokenInfo {
  expires_in?: string;
  access_type?: string;
  scope?: string;
  email?: string;
  email_verified?: string;
  error_description?: string;
}

interface UserInfo {
  name: string | null;
  email: string | null;
  image: string | null;
}

interface SignInStatusResponse {
  authenticated: boolean;
  user?: UserInfo;
  token?: {
    expiresIn: number;
    expiresAt: string;
    scopes: string[];
  };
  error?: string;
}

interface SessionUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

async function getGoogleTokenInfo(
  accessToken: string
): Promise<GoogleTokenInfo | null> {
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
    );
    return response.ok ? ((await response.json()) as GoogleTokenInfo) : null;
  } catch {
    return null;
  }
}

function buildUserInfo(user: SessionUser): UserInfo {
  return {
    name: user.name ?? null,
    email: user.email ?? null,
    image: user.image ?? null,
  };
}

function buildNoSessionResponse(): SignInStatusResponse {
  return { authenticated: false, error: "No active session" };
}

function buildAuthenticatedErrorResponse(
  user: UserInfo,
  error: string
): SignInStatusResponse {
  return { authenticated: true, user, error };
}

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

async function processSignInStatus(
  req: Request
): Promise<SignInStatusResponse> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return buildNoSessionResponse();
  }

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
