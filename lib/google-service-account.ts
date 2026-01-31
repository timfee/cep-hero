import { JWT } from "google-auth-library";

type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
};

function loadServiceAccount(): ServiceAccountCredentials {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!inline) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON env for service account credentials");
  }

  const trimmed = inline.replace(/^['"]|['"]$/g, "");
  const parsed = JSON.parse(trimmed);

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Service account JSON missing client_email or private_key");
  }

  const key = parsed.private_key.includes("\\n")
    ? parsed.private_key.replace(/\\n/g, "\n")
    : parsed.private_key;

  return { client_email: parsed.client_email, private_key: key };
}

export async function getServiceAccountAccessToken(scopes: string[], subject?: string) {
  const { client_email, private_key } = loadServiceAccount();
  const jwt = new JWT({
    email: client_email,
    key: private_key,
    scopes,
    subject,
  });
  const result = await jwt.authorize();
  if (!result.access_token) {
    throw new Error("Failed to obtain service account access token");
  }
  return result.access_token;
}

export function getServiceAccountSubject(defaultEmail: string) {
  return process.env.GOOGLE_TOKEN_EMAIL ?? defaultEmail;
}
