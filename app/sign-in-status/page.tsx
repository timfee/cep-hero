/**
 * Sign-in status page displaying detailed authentication information.
 * Supports both OAuth sessions and default user mode.
 */

"use client";

import {
  AlertTriangle,
  ArrowRightLeft,
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
import {
  formatTimeRemaining,
  performSignOut,
  type SignInStatusResponse,
  type StatusState,
  switchUser,
} from "@/lib/auth/status";
import { cn } from "@/lib/utils";

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
  isDefaultUser: boolean,
  tokenError: string | undefined,
  isTokenExpired: boolean,
  isTokenExpiringSoon: boolean
): StatusInfo {
  if (isDefaultUser) {
    return {
      icon: Shield,
      bgColor: "bg-blue-500/10",
      textColor: "text-blue-500",
      borderColor: "border-blue-500/20",
      label: "Service Account",
      description:
        "Using the delegated admin service account. Token management is automatic.",
    };
  }
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
 * Apply status data to state, updating expiry tracking refs.
 */
function applyStatusData(
  data: SignInStatusResponse,
  setStatus: (state: StatusState) => void,
  setLocalExpiresIn: (value: number) => void,
  expiresAtRef: React.MutableRefObject<number | null>
) {
  setStatus({ loading: false, data, error: null });
  if (data.token?.expiresIn !== undefined) {
    expiresAtRef.current = Date.now() + data.token.expiresIn * 1000;
    setLocalExpiresIn(data.token.expiresIn);
  }
}

/**
 * Action buttons for the status page - extracted to reduce component complexity.
 */
function StatusActions({
  isDefaultUser,
  isTokenExpired,
  isTokenExpiringSoon,
  signingOut,
  onRefresh,
  onReauth,
  onSwitchUser,
  onSignOut,
}: {
  isDefaultUser: boolean;
  isTokenExpired: boolean;
  isTokenExpiringSoon: boolean;
  signingOut: boolean;
  onRefresh: () => void;
  onReauth: () => void;
  onSwitchUser: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 pt-2">
      <Button variant="outline" onClick={onRefresh} className="w-full">
        <RefreshCw className="size-4" />
        Refresh Status
      </Button>

      {!isDefaultUser && (isTokenExpired || isTokenExpiringSoon) && (
        <Button onClick={onReauth} className="w-full">
          <RefreshCw className="size-4" />
          Re-authenticate
        </Button>
      )}

      {isDefaultUser ? (
        <Button variant="outline" onClick={onSwitchUser} className="w-full">
          <ArrowRightLeft className="size-4" />
          Switch User
        </Button>
      ) : (
        <Button
          variant="destructive"
          onClick={onSignOut}
          disabled={signingOut}
          className="w-full"
        >
          <LogOut className="size-4" />
          {signingOut ? "Signing out..." : "Sign Out"}
        </Button>
      )}
    </div>
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

  const isDefaultUser = !!status.data?.isDefaultUser;

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/sign-in-status");

      if (!response.ok) {
        await performSignOut("sign-in-status");
        return;
      }

      const data = (await response.json()) as SignInStatusResponse;

      // Default user mode: always accept the response
      if (data.isDefaultUser) {
        applyStatusData(data, setStatus, setLocalExpiresIn, expiresAtRef);
        return;
      }

      // OAuth mode: sign out if not authenticated or there's an error
      if (!data.authenticated || data.error) {
        await performSignOut("sign-in-status");
        return;
      }

      applyStatusData(data, setStatus, setLocalExpiresIn, expiresAtRef);
    } catch {
      await performSignOut("sign-in-status");
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchStatus();
    })();
  }, [fetchStatus]);

  useEffect(() => {
    if (expiresAtRef.current === null || isDefaultUser) {
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
  }, [status.data?.token?.expiresIn, isDefaultUser]);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    await performSignOut("sign-in-status");
  }, []);

  const handleSwitchUser = useCallback(() => {
    switchUser();
  }, []);

  const handleReauth = useCallback(() => {
    router.push("/sign-in");
  }, [router]);

  const handleRefresh = useCallback(async () => {
    setStatus((prev) => ({ ...prev, loading: true }));
    await fetchStatus();
  }, [fetchStatus]);

  if (status.loading || !status.data) {
    return <LoadingSkeleton />;
  }

  const { user, token } = status.data;
  const isTokenExpired = localExpiresIn !== null && localExpiresIn <= 0;
  const isTokenExpiringSoon = localExpiresIn !== null && localExpiresIn < 300;
  const statusInfo = getStatusInfo(
    isDefaultUser,
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
                {isDefaultUser ? "Using service account" : "Signed in as"}
              </h3>
              <div className="rounded-lg border bg-card p-3">
                <p className="font-medium">{user.name ?? "Unknown"}</p>
                {user.email && (
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                )}
              </div>
            </div>
          )}

          {/* Token Info (only for OAuth users) */}
          {!isDefaultUser && token && localExpiresIn !== null && (
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

          <StatusActions
            isDefaultUser={isDefaultUser}
            isTokenExpired={isTokenExpired}
            isTokenExpiringSoon={isTokenExpiringSoon}
            signingOut={signingOut}
            onRefresh={handleRefresh}
            onReauth={handleReauth}
            onSwitchUser={handleSwitchUser}
            onSignOut={handleSignOut}
          />
        </CardContent>
      </Card>
    </main>
  );
}
