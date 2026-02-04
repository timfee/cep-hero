/**
 * Google Admin SDK client utilities for gimme self-enrollment.
 */

import { OAuth2Client } from "google-auth-library";
import { google, type admin_directory_v1 } from "googleapis";

import { getServiceAccountAccessToken } from "@/lib/google-service-account";

import { ADMIN_SCOPES, TARGET_DOMAIN } from "./constants";
import { type ParsedName } from "./types";
import { stripQuotes } from "./validation";

type DirectoryAdmin = admin_directory_v1.Admin;

/**
 * Create an authenticated Admin SDK client using service account.
 */
export async function createAdminClient(): Promise<DirectoryAdmin> {
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
export async function userExists(
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
 * Create a new user in the directory.
 */
export async function createUser(
  directory: DirectoryAdmin,
  primaryEmail: string,
  password: string,
  name: ParsedName,
  recoveryEmail: string
): Promise<void> {
  await directory.users.insert({
    requestBody: {
      primaryEmail,
      password,
      changePasswordAtNextLogin: true,
      name: { givenName: name.givenName, familyName: name.familyName },
      recoveryEmail,
    },
  });
}

/**
 * Grant super admin privileges to a user.
 */
export async function makeUserSuperAdmin(
  directory: DirectoryAdmin,
  userKey: string
): Promise<void> {
  await directory.users.makeAdmin({ userKey, requestBody: { status: true } });
}

/**
 * Build the target email address from username.
 */
export function buildTargetEmail(username: string): string {
  return `${username}@${TARGET_DOMAIN}`;
}
