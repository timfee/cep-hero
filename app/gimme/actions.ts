/**
 * Server Actions for the self-enrollment gimme page.
 */

"use server";

import { headers } from "next/headers";
import crypto from "node:crypto";

import {
  ALLOWED_EMAIL_SUFFIX,
  buildTargetEmail,
  createAdminClient,
  createUser,
  type EnrollmentResult,
  generatePassword,
  makeUserSuperAdmin,
  MAX_NAME_LENGTH,
  parseName,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  sendErrorEmail,
  sendSuccessEmail,
  stripQuotes,
  userExists,
  validateEmail,
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

  const userAgent = headersList.get("user-agent") ?? "";
  const acceptLang = headersList.get("accept-language") ?? "";
  const fallbackData = `${userAgent}:${acceptLang}:${Date.now()}`;
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
 * Server Action to handle self-enrollment form submission.
 * Returns only notification status - details are sent via email.
 */
export async function enrollUser(
  formData: FormData
): Promise<EnrollmentResult> {
  const name = formData.get("name")?.toString().trim() ?? "";
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  const clientIp = await getClientIp();

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

  if (!name) {
    return { notificationSentTo: "", error: "Name is required" };
  }

  if (name.length > MAX_NAME_LENGTH) {
    return {
      notificationSentTo: "",
      error: `Name must be ${MAX_NAME_LENGTH} characters or less`,
    };
  }

  const emailResult = validateEmail(email);
  if (!emailResult.valid) {
    return { notificationSentTo: "", error: emailResult.error };
  }

  if (!password) {
    return { notificationSentTo: "", error: "Enrollment password is required" };
  }

  // From here on, we have a valid @google.com email.
  // All outcomes (success or failure) are sent via email only.
  const { username } = emailResult;
  const googleEmail = `${username}${ALLOWED_EMAIL_SUFFIX}`;

  const enrollmentPassword = stripQuotes(process.env.SELF_ENROLLMENT_PASSWORD);
  if (!enrollmentPassword) {
    console.error("[gimme] SELF_ENROLLMENT_PASSWORD not configured");
    return sendErrorAndReturn(
      googleEmail,
      name,
      "Self-enrollment is temporarily unavailable. Please contact an administrator."
    );
  }

  if (!timingSafeEqual(password, enrollmentPassword)) {
    console.log("[gimme] invalid enrollment password", { clientIp });
    return sendErrorAndReturn(
      googleEmail,
      name,
      "Invalid enrollment password. Please check with your team lead for the correct password."
    );
  }

  const newEmail = buildTargetEmail(username);
  const newPassword = generatePassword();
  const parsedName = parseName(name);

  console.log("[gimme] creating account", { username, newEmail, clientIp });

  try {
    const directory = await createAdminClient();

    const exists = await userExists(directory, newEmail);
    if (exists) {
      console.log("[gimme] user already exists", { newEmail });
      return sendErrorAndReturn(
        googleEmail,
        name,
        `Account ${newEmail} already exists. Contact an administrator for access.`
      );
    }

    await createUser(directory, newEmail, newPassword, parsedName, googleEmail);
    console.log("[gimme] user created", { newEmail });

    await makeUserSuperAdmin(directory, newEmail);
    console.log("[gimme] super admin granted", { newEmail });

    await sendSuccessEmail(googleEmail, name, newEmail, newPassword);

    return { notificationSentTo: googleEmail };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[gimme] error", { error: errorMessage, clientIp });
    return sendErrorAndReturn(
      googleEmail,
      name,
      "Failed to create account due to a technical error. Please try again or contact an administrator."
    );
  }
}
