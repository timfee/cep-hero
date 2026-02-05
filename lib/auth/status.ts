/**
 * Shared authentication status types and utilities.
 * Used by UserStatusBar and SignInStatusPage components.
 */

/**
 * Response from the sign-in status API endpoint.
 */
export interface SignInStatusResponse {
  authenticated: boolean;
  user?: {
    name: string | null;
    email: string | null;
    image: string | null;
  };
  token?: {
    expiresIn: number;
    expiresAt: string;
    scopes: string[];
  };
  error?: string;
}

/**
 * Internal state for tracking authentication status.
 */
export interface StatusState {
  loading: boolean;
  data: SignInStatusResponse | null;
  error: string | null;
}

/**
 * Formats remaining seconds into a human-readable time string.
 */
export function formatTimeRemaining(seconds: number, compact = false): string {
  if (seconds <= 0) {
    return "Expired";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return compact ? `${hours}h ${minutes}m` : `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Signs out the user and redirects to sign-in page.
 * Uses window.location for hard redirect to ensure cookies are cleared.
 */
export async function performSignOut(context = "auth"): Promise<void> {
  try {
    await fetch("/api/sign-out", { method: "POST" });
  } catch (error) {
    console.log(
      `[${context}] Sign out error:`,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
  // Hard redirect to ensure server sees cleared cookies
  window.location.href = "/sign-in";
}
