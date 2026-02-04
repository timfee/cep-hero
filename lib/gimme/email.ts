/**
 * Email utilities for gimme self-enrollment notifications.
 */

import { JWT } from "google-auth-library";
import { google } from "googleapis";

import { GMAIL_SCOPES } from "./constants";
import { stripQuotes } from "./validation";

/**
 * Common email styles.
 */
const EMAIL_STYLES = `
  body { font-family: 'Google Sans', Arial, sans-serif; line-height: 1.6; color: #202124; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { padding: 20px; border-radius: 8px 8px 0 0; }
  .header-success { background: #1a73e8; color: white; }
  .header-error { background: #d93025; color: white; }
  .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
  .credentials { background: white; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #dadce0; }
  .credential-label { font-size: 12px; color: #5f6368; margin-bottom: 4px; }
  .credential-value { font-family: 'Roboto Mono', monospace; font-size: 14px; color: #202124; }
  .notice { color: #5f6368; font-size: 13px; margin: 12px 0; padding-left: 4px; }
  .chrome-profile { background: #e8f0fe; border: 2px solid #1a73e8; padding: 16px; border-radius: 8px; margin: 16px 0; }
  .chrome-profile-title { color: #1a73e8; font-weight: 600; font-size: 15px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
  .chrome-profile-content { color: #202124; font-size: 14px; }
  .error-box { background: #fce8e6; border: 1px solid #d93025; padding: 12px; border-radius: 8px; margin: 16px 0; }
  .steps { margin: 16px 0; }
  .steps li { margin: 8px 0; }
  a { color: #1a73e8; }
`;

/**
 * Build the success email HTML content.
 */
function buildSuccessEmailHtml(
  name: string,
  newEmail: string,
  password: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${EMAIL_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header header-success">
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

      <p class="notice">You will be required to change this password on first login.</p>

      <div class="chrome-profile">
        <div class="chrome-profile-title">
          <span>&#128736;</span> Create a New Chrome Profile
        </div>
        <div class="chrome-profile-content">
          <strong>Before signing in</strong>, create a dedicated Chrome profile for this account to avoid conflicts with your Corp account and policies.
          <ol style="margin: 8px 0 0 0; padding-left: 20px;">
            <li>Open Chrome and click your profile icon (top right)</li>
            <li>Click <strong>Add</strong> to create a new profile</li>
            <li>Use this new profile to sign in to your cep-netnew.cc account</li>
          </ol>
        </div>
      </div>

      <div class="steps">
        <p><strong>Next Steps:</strong></p>
        <ol>
          <li>Create a new Chrome profile (see above)</li>
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
 * Build the error email HTML content.
 */
function buildErrorEmailHtml(name: string, errorMessage: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${EMAIL_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header header-error">
      <h1 style="margin: 0; font-size: 24px;">CEP Hero Enrollment</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">Unable to complete your request</p>
    </div>
    <div class="content">
      <p>Hi ${name},</p>
      <p>We were unable to process your self-enrollment request for a cep-netnew.cc admin account.</p>

      <div class="error-box">
        <strong>Reason:</strong> ${errorMessage}
      </div>

      <p>If you believe this is an error, please contact your team lead or try again later.</p>

      <p style="color: #5f6368; font-size: 12px; margin-top: 24px;">
        This message was sent via CEP Hero self-enrollment.
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
  htmlBody: string,
  plainText: string
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
    plainText,
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
 * Load service account credentials from environment.
 */
function loadServiceAccountCredentials() {
  const json = stripQuotes(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (!json) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
  }
  const creds = JSON.parse(json);
  const privateKey = creds.private_key.includes(String.raw`\n`)
    ? creds.private_key.replaceAll(String.raw`\n`, "\n")
    : creds.private_key;
  return { clientEmail: creds.client_email, privateKey };
}

/**
 * Get authenticated Gmail client using JWT with domain-wide delegation.
 */
async function getGmailClient() {
  const senderEmail = stripQuotes(process.env.GOOGLE_TOKEN_EMAIL);
  if (!senderEmail) {
    throw new Error("GOOGLE_TOKEN_EMAIL not configured for sending emails");
  }

  const { clientEmail, privateKey } = loadServiceAccountCredentials();

  const jwtClient = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: GMAIL_SCOPES,
    subject: senderEmail,
  });

  await jwtClient.authorize();

  const gmail = google.gmail({ version: "v1", auth: jwtClient });
  return { gmail, senderEmail };
}

/**
 * Send success notification email with credentials.
 */
export async function sendSuccessEmail(
  recipientEmail: string,
  recipientName: string,
  newAccountEmail: string,
  password: string
): Promise<void> {
  const { gmail, senderEmail } = await getGmailClient();

  const htmlBody = buildSuccessEmailHtml(
    recipientName,
    newAccountEmail,
    password
  );
  const plainText = `Hi ${recipientName},

Your CEP Hero admin account has been created.

Email: ${newAccountEmail}
Temporary Password: ${password}

Note: You will be required to change this password on first login.

IMPORTANT - CREATE A NEW CHROME PROFILE

Before signing in, create a dedicated Chrome profile for this account to avoid conflicts with your Corp account and policies:

1. Open Chrome and click your profile icon (top right)
2. Click "Add" to create a new profile
3. Use this new profile to sign in to your cep-netnew.cc account

Next Steps:
1. Create a new Chrome profile (see above)
2. Go to admin.google.com
3. Sign in with your new email address
4. Enter the temporary password above
5. Create a new secure password when prompted`;

  const rawMessage = buildEmailMessage(
    recipientEmail,
    senderEmail,
    `Your CEP Hero Admin Account: ${newAccountEmail}`,
    htmlBody,
    plainText
  );

  await gmail.users.messages.send({
    userId: senderEmail,
    requestBody: { raw: rawMessage },
  });

  console.log("[gimme] success email sent", {
    to: recipientEmail,
    account: newAccountEmail,
  });
}

/**
 * Send error notification email.
 */
export async function sendErrorEmail(
  recipientEmail: string,
  recipientName: string,
  errorMessage: string
): Promise<void> {
  // Debug logging to trace email parameters
  console.log("[gimme] sendErrorEmail called", {
    recipientEmail,
    recipientName,
    errorMessage,
  });

  const { gmail, senderEmail } = await getGmailClient();

  const htmlBody = buildErrorEmailHtml(recipientName, errorMessage);
  const plainText = `Hi ${recipientName},\n\nWe were unable to process your CEP Hero enrollment request.\n\nReason: ${errorMessage}\n\nPlease contact your team lead if you believe this is an error.`;

  const rawMessage = buildEmailMessage(
    recipientEmail,
    senderEmail,
    "CEP Hero Enrollment - Unable to Complete Request",
    htmlBody,
    plainText
  );

  await gmail.users.messages.send({
    userId: senderEmail,
    requestBody: { raw: rawMessage },
  });

  console.log("[gimme] error email sent", {
    to: recipientEmail,
    reason: errorMessage,
  });
}
