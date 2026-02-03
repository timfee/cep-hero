/**
 * Email utilities for gimme self-enrollment welcome messages.
 */

import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";

import { getServiceAccountAccessToken } from "@/lib/google-service-account";

import { GMAIL_SCOPES } from "./constants";
import { stripQuotes } from "./validation";

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
export async function sendWelcomeEmail(
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
