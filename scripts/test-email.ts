/**
 * Test script to send an email via Gmail API.
 * Run with: bun run scripts/test-email.ts
 */

import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";

import { getServiceAccountAccessToken } from "../lib/google-service-account";

const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"];

function stripQuotes(value: string | undefined): string | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  return value.replaceAll(/^['"]|['"]$/g, "");
}

function buildEmailMessage(
  to: string,
  from: string,
  subject: string,
  body: string
): string {
  const message = [
    `From: CEP Hero <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
  ].join("\r\n");

  return Buffer.from(message).toString("base64url");
}

async function sendTestEmail() {
  const senderEmail = stripQuotes(process.env.GOOGLE_TOKEN_EMAIL);
  if (!senderEmail) {
    throw new Error("GOOGLE_TOKEN_EMAIL not configured");
  }

  console.log("[test] Getting access token for:", senderEmail);

  const accessToken = await getServiceAccountAccessToken(
    GMAIL_SCOPES,
    senderEmail
  );

  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: "v1", auth });

  const rawMessage = buildEmailMessage(
    "feel@google.com",
    senderEmail,
    "CEP Hero Test Email",
    "This is a test email from CEP Hero to verify Gmail API integration is working.\n\nIf you received this, the service account is properly configured!"
  );

  console.log("[test] Sending email to feel@google.com...");

  const result = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: rawMessage },
  });

  console.log("[test] Email sent successfully!", {
    id: result.data.id,
    threadId: result.data.threadId,
  });
}

sendTestEmail().catch((error) => {
  console.error("[test] Failed to send email:", error.message);
  process.exit(1);
});
