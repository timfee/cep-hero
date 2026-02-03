import { JWT } from "google-auth-library";

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

function loadServiceAccount(): ServiceAccountCredentials {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (inline === undefined || inline === "") {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_JSON env for service account credentials"
    );
  }

  const trimmed = inline.replaceAll(/^['"]|['"]$/g, "");
  const parsed: unknown = JSON.parse(trimmed);
  if (!isPlainObject(parsed)) {
    throw new Error("Service account JSON must be an object");
  }

  if (
    typeof parsed.client_email !== "string" ||
    parsed.client_email.length === 0 ||
    typeof parsed.private_key !== "string" ||
    parsed.private_key.length === 0
  ) {
    throw new Error("Service account JSON missing client_email or private_key");
  }

  const key = parsed.private_key.includes(String.raw`\n`)
    ? parsed.private_key.replaceAll(String.raw`\n`, "\n")
    : parsed.private_key;

  return { client_email: parsed.client_email, private_key: key };
}

export async function getServiceAccountAccessToken(
  scopes: string[],
  subject?: string
) {
  const { client_email, private_key } = loadServiceAccount();
  const jwt = new JWT({
    email: client_email,
    key: private_key,
    scopes,
    subject,
  });
  const result = await jwt.authorize();
  if (typeof result.access_token !== "string" || result.access_token === "") {
    throw new Error("Failed to obtain service account access token");
  }
  return result.access_token;
}

export function getServiceAccountSubject(defaultEmail: string) {
  const envEmail = process.env.GOOGLE_TOKEN_EMAIL;
  return envEmail === undefined || envEmail === "" ? defaultEmail : envEmail;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
