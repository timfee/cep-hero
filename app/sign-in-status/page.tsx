/**
 * Sign-in status page displaying detailed authentication information.
 */

"use client";

import {
  AlertTriangle,
  CheckCircle,
  Clock,
  LogOut,
  RefreshCw,
  Shield,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Response from the sign-in status API endpoint.
 */
interface SignInStatusResponse {
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
interface StatusState {
  loading: boolean;
  data: SignInStatusResponse | null;
  error: string | null;
}

/**
 * Formats remaining seconds into a human-readable time string.
 */
function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) {
    return "Expired";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
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
async function performSignOut() {
  try {
    await fetch("/api/sign-out", { method: "POST" });
  } catch (error) {
    console.log(
      "[sign-in-status] Sign out error:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
  // Hard redirect to ensure server sees cleared cookies
  window.location.href = "/sign-in";
}

/**
 * Loading skeleton component.
 */
function LoadingSkeleton() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Account Status
          </CardTitle>
          <CardDescription>Loading authentication details...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

/**
 * Status info object type.
 */
interface StatusInfo {
  icon: typeof CheckCircle;
  bgColor: string;
  textColor: string;
  borderColor: string;
  label: string;
  description: string;
}

/**
 * Determines the status indicator style and icon based on token state.
 */
function getStatusInfo(
  tokenError: string | undefined,
  isTokenExpired: boolean,
  isTokenExpiringSoon: boolean
): StatusInfo {
  if (tokenError) {
    return {
      icon: XCircle,
      bgColor: "bg-destructive/10",
      textColor: "text-destructive",
      borderColor: "border-destructive/20",
      label: "Error",
      description: tokenError,
    };
  }
  if (isTokenExpired) {
    return {
      icon: XCircle,
      bgColor: "bg-destructive/10",
      textColor: "text-destructive",
      borderColor: "border-destructive/20",
      label: "Expired",
      description: "Your session has expired. Please re-authenticate.",
    };
  }
  if (isTokenExpiringSoon) {
    return {
      icon: AlertTriangle,
      bgColor: "bg-yellow-500/10",
      textColor: "text-yellow-500",
      borderColor: "border-yellow-500/20",
      label: "Expiring Soon",
      description: "Your session will expire soon. Consider re-authenticating.",
    };
  }
  return {
    icon: CheckCircle,
    bgColor: "bg-emerald-500/10",
    textColor: "text-emerald-500",
    borderColor: "border-emerald-500/20",
    label: "Healthy",
    description: "Your session is active and valid.",
  };
}

/**
 * Connection error display component.
 */
function ConnectionError({
  error,
  onRefresh,
  onSignIn,
}: {
  error: string;
  onRefresh: () => void;
  onSignIn: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Account Status
          </CardTitle>
          <CardDescription>
            Unable to load authentication details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4">
            <XCircle className="size-6 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Connection Error</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={onRefresh} className="w-full">
              <RefreshCw className="size-4" />
              Retry
            </Button>
            <Button onClick={onSignIn} className="w-full">
              <RefreshCw className="size-4" />
              Sign In
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

/**
 * Sign-in status page component.
 */
export default function SignInStatusPage() {
  const router = useRouter();
  const [status, setStatus] = useState<StatusState>({
    loading: true,
    data: null,
    error: null,
  });
  const [localExpiresIn, setLocalExpiresIn] = useState<number | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const expiresAtRef = useRef<number | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/sign-in-status");

      // Server error - sign out
      if (!response.ok) {
        await performSignOut();
        return;
      }

      const data = (await response.json()) as SignInStatusResponse;

      // If not authenticated or there's an error, sign out and redirect
      if (!data.authenticated || data.error) {
        await performSignOut();
        return;
      }

      setStatus({ loading: false, data, error: null });
      if (data.token?.expiresIn !== undefined) {
        expiresAtRef.current = Date.now() + data.token.expiresIn * 1000;
        setLocalExpiresIn(data.token.expiresIn);
      }
    } catch {
      // On any error, sign out and redirect
      await performSignOut();
    }
  }, [router]);

  useEffect(() => {
    (async () => {
      await fetchStatus();
    })();
  }, [fetchStatus]);

  useEffect(() => {
    if (expiresAtRef.current === null) {
      return;
    }

    const timer = setInterval(() => {
      if (expiresAtRef.current === null) {
        return;
      }
      const remaining = Math.max(
        0,
        Math.floor((expiresAtRef.current - Date.now()) / 1000)
      );
      setLocalExpiresIn(remaining);
    }, 1000);

    return () => clearInterval(timer);
  }, [status.data?.token?.expiresIn]);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    await performSignOut();
  }, [router]);

  const handleReauth = useCallback(() => {
    router.push("/sign-in");
  }, [router]);

  const handleRefresh = useCallback(async () => {
    setStatus((prev) => ({ ...prev, loading: true }));
    await fetchStatus();
  }, [fetchStatus]);

  if (status.loading) {
    return <LoadingSkeleton />;
  }

  // If no data, we're redirecting (sign out in progress)
  if (!status.data) {
    return <LoadingSkeleton />;
  }

  const { user, token } = status.data;
  const isTokenExpired = localExpiresIn !== null && localExpiresIn <= 0;
  const isTokenExpiringSoon = localExpiresIn !== null && localExpiresIn < 300;
  const statusInfo = getStatusInfo(
    undefined,
    isTokenExpired,
    isTokenExpiringSoon
  );

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Account Status
          </CardTitle>
          <CardDescription>
            View your authentication details and session status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Badge */}
          <div
            className={cn(
              "flex items-center gap-3 rounded-lg border p-4",
              statusInfo.bgColor,
              statusInfo.borderColor
            )}
          >
            <statusInfo.icon className={cn("size-6", statusInfo.textColor)} />
            <div>
              <p className={cn("font-medium", statusInfo.textColor)}>
                {statusInfo.label}
              </p>
              <p className="text-sm text-muted-foreground">
                {statusInfo.description}
              </p>
            </div>
          </div>

          {/* User Info */}
          {user && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Signed in as
              </h3>
              <div className="rounded-lg border bg-card p-3">
                <p className="font-medium">{user.name ?? "Unknown"}</p>
                {user.email && (
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                )}
              </div>
            </div>
          )}

          {/* Token Info */}
          {token && localExpiresIn !== null && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Session Details
              </h3>
              <div className="rounded-lg border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm">
                    <Clock className="size-4 text-muted-foreground" />
                    Time Remaining
                  </span>
                  <span
                    className={cn("text-sm font-medium", statusInfo.textColor)}
                  >
                    {formatTimeRemaining(localExpiresIn)}
                  </span>
                </div>
                {token.scopes.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Scopes</p>
                    <div className="flex flex-wrap gap-1">
                      {token.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs"
                        >
                          {scope.split("/").pop()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              className="w-full"
            >
              <RefreshCw className="size-4" />
              Refresh Status
            </Button>

            {(isTokenExpired || isTokenExpiringSoon) && (
              <Button onClick={handleReauth} className="w-full">
                <RefreshCw className="size-4" />
                Re-authenticate
              </Button>
            )}

            <Button
              variant="destructive"
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full"
            >
              <LogOut className="size-4" />
              {signingOut ? "Signing out..." : "Sign Out"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
