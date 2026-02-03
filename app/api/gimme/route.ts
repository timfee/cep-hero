/**
 * Self-enrollment API endpoint for creating super admin accounts.
 * This endpoint is accessible without authentication and creates
 * admin accounts in the cep-netnew.cc domain for Google employees.
 */

import { OAuth2Client } from "google-auth-library";
import { google, type admin_directory_v1 } from "googleapis";

import { getServiceAccountAccessToken } from "@/lib/google-service-account";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

type DirectoryAdmin = admin_directory_v1.Admin;

const TARGET_DOMAIN = "cep-netnew.cc";
const ALLOWED_EMAIL_SUFFIX = "@google.com";
const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const ADMIN_SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.user",
  "https://www.googleapis.com/auth/admin.directory.user.security",
];

/**
 * Request body schema for self-enrollment.
 */
interface EnrollmentRequest {
  name: string;
  email: string;
  password: string;
}

/**
 * Validation result for enrollment requests.
 */
type ValidationResult =
  | { valid: true; username: string; name: string }
  | { valid: false; error: string };

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
 * Validate that the request body is a valid object.
 */
function validateBodyStructure(
  body: unknown
): body is Partial<EnrollmentRequest> {
  return body !== null && body !== undefined && typeof body === "object";
}

/**
 * Validate the name field.
 */
function validateName(name: unknown): name is string {
  return typeof name === "string" && name.trim().length > 0;
}

/**
 * Validate the email field and extract username.
 */
function validateAndExtractEmail(
  email: unknown
): { valid: false; error: string } | { valid: true; username: string } {
  if (typeof email !== "string" || email.trim().length === 0) {
    return { valid: false, error: "Email is required" };
  }

  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail.endsWith(ALLOWED_EMAIL_SUFFIX)) {
    return { valid: false, error: "Email must end with @google.com" };
  }

  const username = normalizedEmail.replace(ALLOWED_EMAIL_SUFFIX, "");
  if (username.length === 0 || !/^[a-z0-9._-]+$/i.test(username)) {
    return { valid: false, error: "Invalid email format" };
  }

  return { valid: true, username };
}

/**
 * Validate the enrollment password.
 */
function validateEnrollmentPassword(
  password: unknown
): { valid: false; error: string } | { valid: true } {
  if (typeof password !== "string" || password.length === 0) {
    return { valid: false, error: "Password is required" };
  }

  const enrollmentPassword = stripQuotes(process.env.SELF_ENROLLMENT_PASSWORD);
  if (!enrollmentPassword) {
    console.error("[gimme] SELF_ENROLLMENT_PASSWORD not configured");
    return { valid: false, error: "Self-enrollment is not configured" };
  }

  if (password !== enrollmentPassword) {
    return { valid: false, error: "Invalid enrollment password" };
  }

  return { valid: true };
}

/**
 * Validate the enrollment request body.
 */
function validateRequest(body: unknown): ValidationResult {
  if (!validateBodyStructure(body)) {
    return { valid: false, error: "Invalid request body" };
  }

  const { name, email, password } = body;

  if (!validateName(name)) {
    return { valid: false, error: "Name is required" };
  }

  const emailResult = validateAndExtractEmail(email);
  if (!emailResult.valid) {
    return emailResult;
  }

  const passwordResult = validateEnrollmentPassword(password);
  if (!passwordResult.valid) {
    return passwordResult;
  }

  return { valid: true, username: emailResult.username, name: name.trim() };
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
 * Create an authenticated Admin SDK client using service account.
 */
async function createAdminClient() {
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
  primaryEmail: string
): Promise<boolean> {
  try {
    await directory.users.get({ userKey: primaryEmail });
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
 * Create a new user in the directory.
 */
async function createUserAccount(
  directory: DirectoryAdmin,
  primaryEmail: string,
  password: string,
  fullName: string,
  recoveryEmail: string
) {
  const { givenName, familyName } = parseName(fullName);
  const result = await directory.users.insert({
    requestBody: {
      primaryEmail,
      password,
      changePasswordAtNextLogin: true,
      name: { givenName, familyName },
      recoveryEmail,
    },
  });
  return result.data;
}

/**
 * Grant super admin privileges to a user.
 */
async function makeUserSuperAdmin(directory: DirectoryAdmin, userKey: string) {
  await directory.users.makeAdmin({ userKey, requestBody: { status: true } });
}

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
function buildSuccessResponse(email: string, password: string) {
  return Response.json({
    success: true,
    message: "Account created successfully",
    account: { email, password, changePasswordRequired: true },
    instructions: [
      `Sign in at https://admin.google.com with ${email}`,
      "You will be prompted to change your password on first login",
      "Your recovery email has been set to your Google corporate email",
    ],
  });
}

/**
 * Create the user account and grant admin privileges.
 */
async function createAndPromoteUser(
  username: string,
  name: string,
  clientIp: string
): Promise<Response> {
  const newEmail = `${username}@${TARGET_DOMAIN}`;
  const newPassword = generatePassword();
  const googleEmail = `${username}${ALLOWED_EMAIL_SUFFIX}`;

  console.log("[gimme] creating account", { username, newEmail, clientIp });

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

  await createUserAccount(directory, newEmail, newPassword, name, googleEmail);
  console.log("[gimme] user created", { newEmail });

  await makeUserSuperAdmin(directory, newEmail);
  console.log("[gimme] super admin granted", { newEmail });

  return buildSuccessResponse(newEmail, newPassword);
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

  const validation = validateRequest(body);
  if (!validation.valid) {
    console.log("[gimme] validation failed", {
      error: validation.error,
      clientIp,
    });
    return Response.json({ error: validation.error }, { status: 400 });
  }

  try {
    return await createAndPromoteUser(
      validation.username,
      validation.name,
      clientIp
    );
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
