/**
 * Self-enrollment API endpoint for creating super admin accounts.
 * All sensitive outcomes are sent via email - response only indicates notification was sent.
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
  sendErrorEmail,
  sendSuccessEmail,
  stripQuotes,
  userExists,
  validateEmail,
  validateName,
} from "@/lib/gimme";
import { checkRateLimit, getClientIp, timingSafeEqual } from "@/lib/rate-limit";

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
 * Build notification response - used for all outcomes after validation passes.
 */
function buildNotificationResponse(notificationSentTo: string) {
  return Response.json({
    notificationSentTo,
    message: "Check your email for details",
  });
}

/**
 * Send error email and return notification response.
 */
async function sendErrorAndRespond(
  email: string,
  name: string,
  errorMessage: string
) {
  try {
    await sendErrorEmail(email, name, errorMessage);
  } catch (emailError) {
    console.error("[gimme] failed to send error email", {
      to: email,
      error: emailError instanceof Error ? emailError.message : "Unknown error",
    });
  }
  return buildNotificationResponse(email);
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

  if (
    body === null ||
    body === undefined ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, email, password } = body as Record<string, unknown>;

  const nameResult = validateName(name);
  if (!nameResult.valid) {
    return Response.json({ error: nameResult.error }, { status: 400 });
  }

  const emailResult = validateEmail(email);
  if (!emailResult.valid) {
    return Response.json({ error: emailResult.error }, { status: 400 });
  }

  if (typeof password !== "string" || password.length === 0) {
    return Response.json({ error: "Password is required" }, { status: 400 });
  }

  // From here on, we have valid inputs.
  // All outcomes (success or failure) are sent via email only.
  const { username } = emailResult;
  const googleEmail = `${username}${ALLOWED_EMAIL_SUFFIX}`;
  const validName = nameResult.name;

  const enrollmentPassword = stripQuotes(process.env.SELF_ENROLLMENT_PASSWORD);
  if (!enrollmentPassword) {
    console.error("[gimme] SELF_ENROLLMENT_PASSWORD not configured");
    return sendErrorAndRespond(
      googleEmail,
      validName,
      "Self-enrollment is temporarily unavailable. Please contact an administrator."
    );
  }

  if (!timingSafeEqual(password, enrollmentPassword)) {
    console.log("[gimme] invalid enrollment password", { clientIp });
    return sendErrorAndRespond(
      googleEmail,
      validName,
      "Invalid enrollment password. Please check with your team lead for the correct password."
    );
  }

  const newEmail = buildTargetEmail(username);
  const newPassword = generatePassword();
  const parsedName = parseName(validName);

  console.log("[gimme] creating account", { username, newEmail, clientIp });

  try {
    const directory = await createAdminClient();

    const exists = await userExists(directory, newEmail);
    if (exists) {
      console.log("[gimme] user already exists", { newEmail });
      return sendErrorAndRespond(
        googleEmail,
        validName,
        `Account ${newEmail} already exists. Contact an administrator for access.`
      );
    }

    await createUser(directory, newEmail, newPassword, parsedName, googleEmail);
    console.log("[gimme] user created", { newEmail });

    await makeUserSuperAdmin(directory, newEmail);
    console.log("[gimme] super admin granted", { newEmail });

    await sendSuccessEmail(googleEmail, validName, newEmail, newPassword);

    return buildNotificationResponse(googleEmail);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[gimme] error", { error: errorMessage, clientIp });
    return sendErrorAndRespond(
      googleEmail,
      validName,
      "Failed to create account due to a technical error. Please try again or contact an administrator."
    );
  }
}
