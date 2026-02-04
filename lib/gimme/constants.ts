/**
 * Constants for the gimme self-enrollment feature.
 */

export const TARGET_DOMAIN = "cep-netnew.cc";
export const ALLOWED_EMAIL_SUFFIX = "@google.com";
export const MAX_NAME_LENGTH = 200;
export const RATE_LIMIT_MAX_REQUESTS = 5;
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export const ADMIN_SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.user",
  "https://www.googleapis.com/auth/admin.directory.user.security",
];

export const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"];
