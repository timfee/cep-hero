import { betterAuth } from "better-auth";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET ?? "better-auth-dev-secret-change-me",
  socialProviders: {
    google: {
      clientId: getRequiredEnv("GOOGLE_CLIENT_ID"),
      clientSecret: getRequiredEnv("GOOGLE_CLIENT_SECRET"),
      accessType: "offline",
      prompt: "select_account consent",
      scope: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/chrome.management.reports.readonly",
        "https://www.googleapis.com/auth/cloud-platform",
        "https://www.googleapis.com/auth/chrome.management.profiles.readonly",
        "https://www.googleapis.com/auth/chrome.management.policy",
        "https://www.googleapis.com/auth/cloud-identity.policies",
        "https://www.googleapis.com/auth/admin.reports.audit.readonly",
        "https://www.googleapis.com/auth/ediscovery",
      ],
    },
  },
  account: {
    storeAccountCookie: true,
    storeStateStrategy: "cookie",
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 7,
      refreshCache: true,
      strategy: "jwe",
    },
  },
});

/**
 * Resolve a required environment variable.
 */
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} environment variable`);
  }

  return value;
}
