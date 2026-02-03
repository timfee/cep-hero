/**
 * Server Actions for the self-enrollment gimme page.
 */

"use server";

import { OAuth2Client } from "google-auth-library";
import { google, type admin_directory_v1 } from "googleapis";
import { headers } from "next/headers";
import crypto from "node:crypto";

import { getServiceAccountAccessToken } from "@/lib/google-service-account";
import { checkRateLimit, timingSafeEqual } from "@/lib/rate-limit";

type DirectoryAdmin = admin_directory_v1.Admin;

const TARGET_DOMAIN = "cep-netnew.cc";
const ALLOWED_EMAIL_SUFFIX = "@google.com";
const MAX_NAME_LENGTH = 200;
const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const ADMIN_SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.user",
  "https://www.googleapis.com/auth/admin.directory.user.security",
];

const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"];

/**
 * Result type for the enrollment action.
 */
export type EnrollmentResult =
  | {
      success: true;
      email: string;
      notificationSentTo: string;
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
 * Falls back to a hash of request metadata to prevent DoS via missing headers.
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
 * Server Action to handle self-enrollment form submission.
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
      success: false,
      error: `Too many requests. Please try again in ${minutes} minutes.`,
    };
  }

  if (!name) {
    return { success: false, error: "Name is required" };
  }

  if (name.length > MAX_NAME_LENGTH) {
    return {
      success: false,
      error: `Name must be ${MAX_NAME_LENGTH} characters or less`,
    };
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

  if (!timingSafeEqual(password, enrollmentPassword)) {
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

    await sendWelcomeEmail(email, name, newEmail, newPassword);

    return {
      success: true,
      email: newEmail,
      notificationSentTo: email,
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
