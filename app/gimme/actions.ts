/**
 * Server Actions for the self-enrollment gimme page.
 */

"use server";

import { headers } from "next/headers";
import crypto from "node:crypto";

import {
  buildTargetEmail,
  createAdminClient,
  createUser,
  type EnrollmentInput,
  type EnrollmentResult,
  EnrollmentSchema,
  extractUsername,
  generatePassword,
  makeUserSuperAdmin,
  parseName,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  sendErrorEmail,
  sendSuccessEmail,
  stripQuotes,
  userExists,
} from "@/lib/gimme";
import { checkRateLimit, timingSafeEqual } from "@/lib/rate-limit";

export type { EnrollmentResult } from "@/lib/gimme";

/**
 * Get the client IP from request headers.
 */
async function getClientIp(): Promise<string> {
  const headersList = await headers();

  const forwarded = headersList.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = headersList.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback: hash browser fingerprint for rate limiting
  const userAgent = headersList.get("user-agent") ?? "";
  const acceptLang = headersList.get("accept-language") ?? "";
  const acceptEnc = headersList.get("accept-encoding") ?? "";
  const secChUa = headersList.get("sec-ch-ua") ?? "";
  const secChUaPlatform = headersList.get("sec-ch-ua-platform") ?? "";
  const fallbackData = `${userAgent}:${acceptLang}:${acceptEnc}:${secChUa}:${secChUaPlatform}`;
  return `anon-${crypto.createHash("sha256").update(fallbackData).digest("hex").slice(0, 16)}`;
}

/**
 * Send error email and return standard response.
 */
async function sendErrorAndReturn(
  email: string,
  name: string,
  errorMessage: string
): Promise<EnrollmentResult> {
  try {
    await sendErrorEmail(email, name, errorMessage);
  } catch (emailError) {
    console.error("[gimme] failed to send error email", {
      to: email,
      error: emailError instanceof Error ? emailError.message : "Unknown error",
    });
  }
  return { notificationSentTo: email };
}

/**
 * Validate the enrollment password against the configured secret.
 */
function validateEnrollmentPassword(
  password: string,
  clientIp: string
): { valid: true } | { valid: false; error: string } {
  const enrollmentPassword = stripQuotes(process.env.SELF_ENROLLMENT_PASSWORD);
  if (!enrollmentPassword) {
    console.error("[gimme] SELF_ENROLLMENT_PASSWORD not configured");
    return {
      valid: false,
      error:
        "Self-enrollment is temporarily unavailable. Please contact an administrator.",
    };
  }

  if (!timingSafeEqual(password, enrollmentPassword)) {
    console.log("[gimme] invalid enrollment password", { clientIp });
    return {
      valid: false,
      error:
        "Invalid enrollment password. Please check with your team lead for the correct password.",
    };
  }

  return { valid: true };
}

/**
 * Create the admin account in Google Workspace.
 */
async function createAdminAccount(
  input: EnrollmentInput,
  clientIp: string
): Promise<EnrollmentResult> {
  const username = extractUsername(input.email);
  const googleEmail = input.email;
  const newEmail = buildTargetEmail(username);
  const newPassword = generatePassword();
  const parsedName = parseName(input.name);

  console.log("[gimme] creating account", { username, newEmail, clientIp });

  const directory = await createAdminClient();

  const exists = await userExists(directory, newEmail);
  if (exists) {
    console.log("[gimme] user already exists", { newEmail });
    return sendErrorAndReturn(
      googleEmail,
      input.name,
      `Account ${newEmail} already exists. Contact an administrator for access.`
    );
  }

  await createUser(directory, newEmail, newPassword, parsedName, googleEmail);
  console.log("[gimme] user created", { newEmail });

  await makeUserSuperAdmin(directory, newEmail);
  console.log("[gimme] super admin granted", { newEmail });

  await sendSuccessEmail(googleEmail, input.name, newEmail, newPassword);
  return { notificationSentTo: googleEmail };
}

/**
 * Check rate limit and return error if exceeded.
 */
function checkRateLimitError(clientIp: string): EnrollmentResult | null {
  const rateLimit = checkRateLimit({
    identifier: `gimme:${clientIp}`,
    maxRequests: RATE_LIMIT_MAX_REQUESTS,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    const minutes = Math.ceil(rateLimit.resetIn / 60_000);
    return {
      notificationSentTo: "",
      error: `Too many requests. Please try again in ${minutes} minutes.`,
    };
  }

  return null;
}

/**
 * Server Action to handle self-enrollment form submission.
 * Returns only notification status - details are sent via email.
 */
export async function enrollUser(
  formData: FormData
): Promise<EnrollmentResult> {
  const clientIp = await getClientIp();

  // Rate limit check
  const rateLimitError = checkRateLimitError(clientIp);
  if (rateLimitError) {
    return rateLimitError;
  }

  // Parse and validate form data with Zod
  const rawData = {
    name: formData.get("name")?.toString() ?? "",
    email: formData.get("email")?.toString() ?? "",
    password: formData.get("password")?.toString() ?? "",
  };

  const parseResult = EnrollmentSchema.safeParse(rawData);
  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0];
    return { notificationSentTo: "", error: firstError.message };
  }

  const input = parseResult.data;

  // Validate enrollment password (timing-safe, not in Zod schema)
  const passwordResult = validateEnrollmentPassword(input.password, clientIp);
  if (!passwordResult.valid) {
    return sendErrorAndReturn(input.email, input.name, passwordResult.error);
  }

  // Create the account
  try {
    return await createAdminAccount(input, clientIp);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[gimme] error", { error: errorMessage, clientIp });
    return sendErrorAndReturn(
      input.email,
      input.name,
      "Failed to create account due to a technical error. Please try again or contact an administrator."
    );
  }
}
