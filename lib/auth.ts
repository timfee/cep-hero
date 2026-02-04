/**
 * Better Auth configuration for Google OAuth with Chrome Enterprise scopes.
 */

import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

import { getRequiredEnv } from "./utils";

/**
 * Configured Better Auth instance with Google OAuth provider and Chrome Enterprise scopes.
 */
export const auth = betterAuth({
  logger: {
    level: "debug",
  },
  socialProviders: {
    google: {
      clientId: getRequiredEnv("GOOGLE_CLIENT_ID"),
      clientSecret: getRequiredEnv("GOOGLE_CLIENT_SECRET"),
      accessType: "offline",
      prompt: "consent",
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
        "https://www.googleapis.com/auth/admin.directory.orgunit",
        "https://www.googleapis.com/auth/admin.directory.group",
        "https://www.googleapis.com/auth/admin.directory.user",
      ],
    },
  },

  plugins: [nextCookies()],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 12 * 60 * 60,
      strategy: "jwe",
      refreshCache: true,
    },
  },
  account: {
    storeStateStrategy: "cookie",
    storeAccountCookie: true,
  },
});
