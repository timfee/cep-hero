"use client";

import { AlertTriangle, Clock, LogIn, LogOut, RefreshCw } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function UserStatusBar() {
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
      const data = (await response.json()) as SignInStatusResponse;
      setStatus({ loading: false, data, error: null });
      if (data.token?.expiresIn !== undefined) {
        expiresAtRef.current = Date.now() + data.token.expiresIn * 1000;
        setLocalExpiresIn(data.token.expiresIn);
      }
    } catch (err) {
      setStatus({
        loading: false,
        data: null,
        error: err instanceof Error ? err.message : "Failed to fetch status",
      });
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const interval = setInterval(() => {
      void fetchStatus();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    if (expiresAtRef.current === null) {
      return undefined;
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
    try {
      await fetch("/api/sign-out", { method: "POST" });
      router.push("/sign-in");
    } catch (err) {
      console.log(
        "[user-status-bar] Sign out error:",
        err instanceof Error ? err.message : "Unknown error"
      );
      router.push("/sign-in");
    }
  }, [router]);

  const handleReauth = useCallback(() => {
    router.push("/sign-in");
  }, [router]);

  /**
   * Branding component displayed on the left side of the header.
   */
  const Branding = () => (
    <div className="flex items-center gap-2">
      <Image
        src="/icon.png"
        alt="CEP Hero"
        width={24}
        height={24}
        className="rounded"
      />
      <span className="text-lg font-semibold text-foreground">CEP Hero</span>
    </div>
  );

  if (status.loading) {
    return (
      <div className="flex h-12 items-center justify-between border-b border-white/[0.06] bg-card/50 px-4">
        <Branding />
        <div className="flex items-center gap-2">
          <div className="size-6 animate-pulse rounded-full bg-muted" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!status.data?.authenticated || status.error) {
    return (
      <div className="flex h-12 items-center justify-between border-b border-white/[0.06] bg-card/50 px-4">
        <Branding />
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Not signed in</span>
          <Button size="sm" variant="outline" onClick={handleReauth}>
            <LogIn className="size-4" />
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  const { user, token, error: tokenError } = status.data;
  const displayName = user?.name ?? user?.email ?? "User";
  const isTokenExpired = localExpiresIn !== null && localExpiresIn <= 0;
  const isTokenExpiringSoon = localExpiresIn !== null && localExpiresIn < 300;

  /**
   * Determines the status indicator style and text based on token state.
   */
  const getStatusIndicator = () => {
    if (tokenError) {
      return {
        bgColor: "bg-destructive/10",
        textColor: "text-destructive",
        text: "Error",
      };
    }
    if (isTokenExpired) {
      return {
        bgColor: "bg-destructive/10",
        textColor: "text-destructive",
        text: "Expired",
      };
    }
    if (isTokenExpiringSoon) {
      return {
        bgColor: "bg-yellow-500/10",
        textColor: "text-yellow-500",
        text: formatTimeRemaining(localExpiresIn ?? 0),
      };
    }
    return {
      bgColor: "bg-emerald-500/10",
      textColor: "text-emerald-400",
      text: formatTimeRemaining(localExpiresIn ?? 0),
    };
  };

  const statusIndicator =
    token && localExpiresIn !== null ? getStatusIndicator() : null;

  return (
    <div className="flex h-12 items-center justify-between border-b border-white/[0.06] bg-card/50 px-4">
      <Branding />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-white/[0.06]"
            aria-label={`Account menu for ${displayName}`}
          >
            <div className="flex flex-col items-end">
              <span className="text-sm font-medium leading-none">
                {displayName}
              </span>
              {user?.email && user.email !== displayName && (
                <span className="text-xs text-muted-foreground">
                  {user.email}
                </span>
              )}
            </div>
            {/* Countdown timer replacing avatar */}
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-xs font-medium",
                statusIndicator
                  ? cn(statusIndicator.bgColor, statusIndicator.textColor)
                  : "bg-muted text-muted-foreground"
              )}
            >
              {statusIndicator ? (
                <Clock className="size-4" />
              ) : (
                <AlertTriangle className="size-4" />
              )}
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Sign-in status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {/* Status info section */}
          <div className="px-2 py-2">
            <div className="flex items-center gap-2">
              {statusIndicator ? (
                <div
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs",
                    statusIndicator.bgColor,
                    statusIndicator.textColor
                  )}
                >
                  <Clock className="size-3" />
                  <span>{statusIndicator.text}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                  <AlertTriangle className="size-3" />
                  <span>Unknown status</span>
                </div>
              )}
            </div>
            {tokenError && (
              <p className="mt-1 text-xs text-destructive">
                Token error detected
              </p>
            )}
          </div>
          <DropdownMenuSeparator />
          {(isTokenExpired || isTokenExpiringSoon || tokenError) && (
            <>
              <DropdownMenuItem onClick={handleReauth}>
                <RefreshCw className="size-4" />
                Re-authenticate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            variant="destructive"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            <LogOut className="size-4" />
            {signingOut ? "Signing out..." : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
