/**
 * Self-enrollment API endpoint for creating super admin accounts.
 */

import {
  ALLOWED_EMAIL_SUFFIX,
  buildTargetEmail,
  createAdminClient,
  createUser,
  generatePassword,
  makeUserSuperAdmin,
  parseName,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  sendWelcomeEmail,
  userExists,
  validateEnrollmentRequest,
} from "@/lib/gimme";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Build rate limit error response.
 */
function buildRateLimitResponse(resetIn: number) {
  const retryAfter = Math.ceil(resetIn / 1000);
  return Response.json(
    { error: "Too many requests. Please try again later.", retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

/**
 * Build success response with account details.
 */
function buildSuccessResponse(email: string, notificationSentTo: string) {
  return Response.json({
    success: true,
    message: "Account created successfully",
    email,
    notificationSentTo,
    instructions: [
      "Check your email for login credentials",
      `Sign in at https://admin.google.com with ${email}`,
      "You will be prompted to change your password on first login",
    ],
  });
}

/**
 * Handle POST requests for self-enrollment.
 */
export async function POST(request: Request) {
  const clientIp = getClientIp(request);

  const rateLimitResult = checkRateLimit({
    identifier: `gimme:${clientIp}`,
    maxRequests: RATE_LIMIT_MAX_REQUESTS,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimitResult.allowed) {
    console.log("[gimme] rate limited", { clientIp });
    return buildRateLimitResponse(rateLimitResult.resetIn);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateEnrollmentRequest(body);
  if (!validation.valid) {
    console.log("[gimme] validation failed", {
      error: validation.error,
      clientIp,
    });
    return Response.json({ error: validation.error }, { status: 400 });
  }

  const { username, name } = validation;
  const newEmail = buildTargetEmail(username);
  const newPassword = generatePassword();
  const googleEmail = `${username}${ALLOWED_EMAIL_SUFFIX}`;
  const parsedName = parseName(name);

  console.log("[gimme] creating account", { username, newEmail, clientIp });

  try {
    const directory = await createAdminClient();

    const exists = await userExists(directory, newEmail);
    if (exists) {
      console.log("[gimme] user already exists", { newEmail });
      return Response.json(
        {
          error: `Account ${newEmail} already exists. Contact an administrator for access.`,
        },
        { status: 409 }
      );
    }

    await createUser(directory, newEmail, newPassword, parsedName, googleEmail);
    console.log("[gimme] user created", { newEmail });

    await makeUserSuperAdmin(directory, newEmail);
    console.log("[gimme] super admin granted", { newEmail });

    await sendWelcomeEmail(googleEmail, name, newEmail, newPassword);

    return buildSuccessResponse(newEmail, googleEmail);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[gimme] error", { error: errorMessage, clientIp });
    return Response.json(
      {
        error:
          "Failed to create account. Please try again or contact an administrator.",
      },
      { status: 500 }
    );
  }
}
