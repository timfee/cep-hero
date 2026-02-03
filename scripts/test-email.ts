/**
 * Test script to send an email via Gmail API.
 * Run with: bun run scripts/test-email.ts
 */

import { JWT } from "google-auth-library";
import { google } from "googleapis";

const GMAIL_SCOPES = ["https://mail.google.com/"];

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

  const json = stripQuotes(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (!json) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
  }

  const creds = JSON.parse(json);
  const privateKey = creds.private_key.includes("\\n")
    ? creds.private_key.replaceAll("\\n", "\n")
    : creds.private_key;

  console.log("[test] Creating JWT client for:", senderEmail);

  const jwtClient = new JWT({
    email: creds.client_email,
    key: privateKey,
    scopes: GMAIL_SCOPES,
    subject: senderEmail,
  });

  await jwtClient.authorize();
  console.log("[test] JWT authorized");

  const gmail = google.gmail({ version: "v1", auth: jwtClient });

  const rawMessage = buildEmailMessage(
    "feel@google.com",
    senderEmail,
    "CEP Hero Test Email",
    "This is a test email from CEP Hero to verify Gmail API integration is working.\n\nIf you received this, the service account is properly configured!"
  );

  console.log("[test] Sending email to feel@google.com...");

  const result = await gmail.users.messages.send({
    userId: senderEmail,
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
