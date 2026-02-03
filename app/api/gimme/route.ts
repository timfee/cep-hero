/**
 * Self-enrollment API endpoint for creating super admin accounts.
 * This endpoint is accessible without authentication and creates
 * admin accounts in the cep-netnew.cc domain for Google employees.
 */

import { OAuth2Client } from "google-auth-library";
import { google, type admin_directory_v1 } from "googleapis";

import { getServiceAccountAccessToken } from "@/lib/google-service-account";
import { checkRateLimit, getClientIp, timingSafeEqual } from "@/lib/rate-limit";

type DirectoryAdmin = admin_directory_v1.Admin;

const TARGET_DOMAIN = "cep-netnew.cc";
const ALLOWED_EMAIL_SUFFIX = "@google.com";
const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const ADMIN_SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.user",
  "https://www.googleapis.com/auth/admin.directory.user.security",
];

const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"];

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
 * Maximum allowed length for name field.
 */
const MAX_NAME_LENGTH = 200;

/**
 * Validate that the request body is a valid object (not null, not array).
 */
function validateBodyStructure(
  body: unknown
): body is Partial<EnrollmentRequest> {
  return (
    body !== null &&
    body !== undefined &&
    typeof body === "object" &&
    !Array.isArray(body)
  );
}

/**
 * Validate the name field with length limits.
 */
function validateName(
  name: unknown
): { valid: false; error: string } | { valid: true; name: string } {
  if (typeof name !== "string" || name.trim().length === 0) {
    return { valid: false, error: "Name is required" };
  }

  const trimmedName = name.trim();
  if (trimmedName.length > MAX_NAME_LENGTH) {
    return {
      valid: false,
      error: `Name must be ${MAX_NAME_LENGTH} characters or less`,
    };
  }

  return { valid: true, name: trimmedName };
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
 * Validate the enrollment password using timing-safe comparison.
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

  if (!timingSafeEqual(password, enrollmentPassword)) {
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

  const nameResult = validateName(name);
  if (!nameResult.valid) {
    return nameResult;
  }

  const emailResult = validateAndExtractEmail(email);
  if (!emailResult.valid) {
    return emailResult;
  }

  const passwordResult = validateEnrollmentPassword(password);
  if (!passwordResult.valid) {
    return passwordResult;
  }

  return { valid: true, username: emailResult.username, name: nameResult.name };
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
 * Build the welcome email HTML content.
 */
function buildWelcomeEmailHtml(
  name: string,
  newEmail: string,
  password: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Google Sans', Arial, sans-serif; line-height: 1.6; color: #202124; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a73e8; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
    .credentials { background: white; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #dadce0; }
    .credential-label { font-size: 12px; color: #5f6368; margin-bottom: 4px; }
    .credential-value { font-family: 'Roboto Mono', monospace; font-size: 14px; color: #202124; }
    .warning { background: #fef7e0; border: 1px solid #f9ab00; padding: 12px; border-radius: 8px; margin: 16px 0; }
    .steps { margin: 16px 0; }
    .steps li { margin: 8px 0; }
    a { color: #1a73e8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">Welcome to CEP Hero</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">Your admin account has been created</p>
    </div>
    <div class="content">
      <p>Hi ${name},</p>
      <p>Your super admin account for <strong>cep-netnew.cc</strong> has been created successfully.</p>

      <div class="credentials">
        <div style="margin-bottom: 12px;">
          <div class="credential-label">Email Address</div>
          <div class="credential-value">${newEmail}</div>
        </div>
        <div>
          <div class="credential-label">Temporary Password</div>
          <div class="credential-value">${password}</div>
        </div>
      </div>

      <div class="warning">
        <strong>Important:</strong> You will be required to change this password on first login.
      </div>

      <div class="steps">
        <p><strong>Next Steps:</strong></p>
        <ol>
          <li>Go to <a href="https://admin.google.com">admin.google.com</a></li>
          <li>Sign in with your new email address</li>
          <li>Enter the temporary password above</li>
          <li>Create a new secure password when prompted</li>
        </ol>
      </div>

      <p style="color: #5f6368; font-size: 12px; margin-top: 24px;">
        This account was created via CEP Hero self-enrollment. Your @google.com email has been set as the recovery email.
      </p>
    </div>
  </div>
</body>
</html>
`.trim();
}

/**
 * Build a RFC 2822 formatted email message.
 */
function buildEmailMessage(
  to: string,
  from: string,
  subject: string,
  htmlBody: string
): string {
  const boundary = `boundary_${Date.now()}`;
  const message = [
    `From: CEP Hero <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    "Your CEP Hero admin account has been created. Please view this email in an HTML-capable email client.",
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    htmlBody,
    "",
    `--${boundary}--`,
  ].join("\r\n");

  return Buffer.from(message).toString("base64url");
}

/**
 * Send welcome email via Gmail API.
 */
async function sendWelcomeEmail(
  recipientEmail: string,
  recipientName: string,
  newAccountEmail: string,
  password: string
): Promise<void> {
  const senderEmail = stripQuotes(process.env.GOOGLE_TOKEN_EMAIL);
  if (!senderEmail) {
    throw new Error("GOOGLE_TOKEN_EMAIL not configured for sending emails");
  }

  const accessToken = await getServiceAccountAccessToken(
    GMAIL_SCOPES,
    senderEmail
  );
  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: "v1", auth });

  const htmlBody = buildWelcomeEmailHtml(
    recipientName,
    newAccountEmail,
    password
  );
  const rawMessage = buildEmailMessage(
    recipientEmail,
    senderEmail,
    `Your CEP Hero Admin Account: ${newAccountEmail}`,
    htmlBody
  );

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: rawMessage },
  });

  console.log("[gimme] welcome email sent", {
    to: recipientEmail,
    account: newAccountEmail,
  });
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

  await sendWelcomeEmail(googleEmail, name, newEmail, newPassword);

  return buildSuccessResponse(newEmail, googleEmail);
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
