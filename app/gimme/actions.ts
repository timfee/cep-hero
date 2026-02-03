/**
 * Server Actions for the self-enrollment gimme page.
 */

"use server";

import { OAuth2Client } from "google-auth-library";
import { google, type admin_directory_v1 } from "googleapis";
import { headers } from "next/headers";

import { getServiceAccountAccessToken } from "@/lib/google-service-account";

type DirectoryAdmin = admin_directory_v1.Admin;

const TARGET_DOMAIN = "cep-netnew.cc";
const ALLOWED_EMAIL_SUFFIX = "@google.com";

const ADMIN_SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.user",
  "https://www.googleapis.com/auth/admin.directory.user.security",
];

const RATE_LIMIT_STORE = new Map<
  string,
  { count: number; resetTime: number }
>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Result type for the enrollment action.
 */
export type EnrollmentResult =
  | {
      success: true;
      email: string;
      password: string;
      instructions: string[];
    }
  | {
      success: false;
      error: string;
    };

/**
 * Strip surrounding quotes from environment variable values.
 */
function stripQuotes(value: string | undefined): string | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  return value.replaceAll(/^['"]|['"]$/g, "");
}

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
  return "unknown";
}

/**
 * Check rate limit for the given IP.
 */
function checkRateLimit(ip: string): { allowed: boolean; resetIn: number } {
  const now = Date.now();
  const entry = RATE_LIMIT_STORE.get(ip);

  if (RATE_LIMIT_STORE.size > 1000) {
    for (const [key, val] of RATE_LIMIT_STORE) {
      if (now > val.resetTime) {
        RATE_LIMIT_STORE.delete(key);
      }
    }
  }

  if (!entry || now > entry.resetTime) {
    RATE_LIMIT_STORE.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true, resetIn: RATE_LIMIT_WINDOW_MS };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, resetIn: entry.resetTime - now };
  }

  entry.count += 1;
  return { allowed: true, resetIn: entry.resetTime - now };
}

/**
 * Create an authenticated Admin SDK client using service account.
 */
async function createAdminClient(): Promise<DirectoryAdmin> {
  const tokenEmail = stripQuotes(process.env.GOOGLE_TOKEN_EMAIL);
  if (!tokenEmail) {
    throw new Error("GOOGLE_TOKEN_EMAIL not configured");
  }

  const accessToken = await getServiceAccountAccessToken(
    ADMIN_SCOPES,
    tokenEmail
  );
  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: accessToken });
  return google.admin({ version: "directory_v1", auth });
}

/**
 * Check if a user already exists in the directory.
 */
async function userExists(
  directory: DirectoryAdmin,
  email: string
): Promise<boolean> {
  try {
    await directory.users.get({ userKey: email });
    return true;
  } catch (error) {
    const googleError = error as { code?: number };
    if (googleError.code === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Generate a secure random password.
 */
function generatePassword(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return [...array].map((byte) => chars[byte % chars.length]).join("");
}

/**
 * Parse name into given and family name components.
 */
function parseName(fullName: string): {
  givenName: string;
  familyName: string;
} {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { givenName: parts[0], familyName: parts[0] };
  }
  return { givenName: parts[0], familyName: parts.slice(1).join(" ") };
}

/**
 * Server Action to handle self-enrollment form submission.
 */
export async function enrollUser(
  formData: FormData
): Promise<EnrollmentResult> {
  const name = formData.get("name")?.toString().trim() ?? "";
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  const clientIp = await getClientIp();

  const rateLimit = checkRateLimit(clientIp);
  if (!rateLimit.allowed) {
    const minutes = Math.ceil(rateLimit.resetIn / 60_000);
    return {
      success: false,
      error: `Too many requests. Please try again in ${minutes} minutes.`,
    };
  }

  if (!name) {
    return { success: false, error: "Name is required" };
  }

  if (!email) {
    return { success: false, error: "Email is required" };
  }

  if (!email.endsWith(ALLOWED_EMAIL_SUFFIX)) {
    return { success: false, error: "Email must end with @google.com" };
  }

  const username = email.replace(ALLOWED_EMAIL_SUFFIX, "");
  if (!username || !/^[a-z0-9._-]+$/i.test(username)) {
    return { success: false, error: "Invalid email format" };
  }

  if (!password) {
    return { success: false, error: "Enrollment password is required" };
  }

  const enrollmentPassword = stripQuotes(process.env.SELF_ENROLLMENT_PASSWORD);
  if (!enrollmentPassword) {
    console.error("[gimme] SELF_ENROLLMENT_PASSWORD not configured");
    return { success: false, error: "Self-enrollment is not configured" };
  }

  if (password !== enrollmentPassword) {
    return { success: false, error: "Invalid enrollment password" };
  }

  const newEmail = `${username}@${TARGET_DOMAIN}`;
  const newPassword = generatePassword();
  const { givenName, familyName } = parseName(name);

  console.log("[gimme] creating account", { username, newEmail, clientIp });

  try {
    const directory = await createAdminClient();

    const exists = await userExists(directory, newEmail);
    if (exists) {
      console.log("[gimme] user already exists", { newEmail });
      return {
        success: false,
        error: `Account ${newEmail} already exists. Contact an administrator for access.`,
      };
    }

    await directory.users.insert({
      requestBody: {
        primaryEmail: newEmail,
        password: newPassword,
        changePasswordAtNextLogin: true,
        name: { givenName, familyName },
        recoveryEmail: email,
      },
    });
    console.log("[gimme] user created", { newEmail });

    await directory.users.makeAdmin({
      userKey: newEmail,
      requestBody: { status: true },
    });
    console.log("[gimme] super admin granted", { newEmail });

    return {
      success: true,
      email: newEmail,
      password: newPassword,
      instructions: [
        `Sign in at https://admin.google.com with ${newEmail}`,
        "You will be prompted to change your password on first login",
        "Your recovery email has been set to your Google corporate email",
      ],
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[gimme] error", { error: errorMessage, clientIp });
    return {
      success: false,
      error:
        "Failed to create account. Please try again or contact an administrator.",
    };
  }
}
