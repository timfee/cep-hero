/**
 * Header component with user authentication status and dropdown menu.
 * Supports both OAuth sessions and default user mode.
 */

"use client";

import {
  AlertTriangle,
  ArrowRightLeft,
  Clock,
  LogIn,
  LogOut,
  RefreshCw,
  Shield,
  User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  formatTimeRemaining,
  performSignOut,
  type SignInStatusResponse,
  type StatusState,
  switchUser,
} from "@/lib/auth/status";
import { cn } from "@/lib/utils";

/**
 * Branding component displayed on the left side of the header.
 * Defined outside UserStatusBar to prevent re-creation on every render.
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

  const isDefaultUser = status.data?.isDefaultUser === true;

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/sign-in-status");

      if (!response.ok) {
        await performSignOut("user-status-bar");
        return;
      }

      const data = (await response.json()) as SignInStatusResponse;

      // Default user mode: always accept the response even with errors
      if (data.isDefaultUser) {
        setStatus({ loading: false, data, error: null });
        if (data.token?.expiresIn !== undefined) {
          expiresAtRef.current = Date.now() + data.token.expiresIn * 1000;
          setLocalExpiresIn(data.token.expiresIn);
        }
        return;
      }

      // OAuth mode: sign out if not authenticated or there's an error
      if (!data.authenticated || data.error) {
        await performSignOut("user-status-bar");
        return;
      }

      setStatus({ loading: false, data, error: null });
      if (data.token?.expiresIn !== undefined) {
        expiresAtRef.current = Date.now() + data.token.expiresIn * 1000;
        setLocalExpiresIn(data.token.expiresIn);
      }
    } catch {
      await performSignOut("user-status-bar");
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

    // Default users don't need a countdown timer
    if (isDefaultUser) {
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
    }, 60_000);

    return () => clearInterval(timer);
  }, [status.data?.token?.expiresIn, isDefaultUser]);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    await performSignOut("user-status-bar");
  }, []);

  const handleSwitchUser = useCallback(() => {
    switchUser();
  }, []);

  const handleReauth = useCallback(() => {
    router.push("/sign-in");
  }, [router]);

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

  // Show "Not signed in" when not authenticated or redirecting
  if (!status.data?.authenticated) {
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
    // Default user always shows a healthy "Service Account" indicator
    if (isDefaultUser) {
      return {
        bgColor: "bg-blue-500/10",
        textColor: "text-blue-400",
        text: "Service Account",
      };
    }

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
      text: formatTimeRemaining(localExpiresIn ?? 0, true),
    };
  };

  // Default users always show a status badge (no token/expiry to check).
  // OAuth users only show one when token info is available.
  const statusIndicator =
    isDefaultUser || (token && localExpiresIn !== null)
      ? getStatusIndicator()
      : null;

  return (
    <div className="flex h-12 items-center justify-between border-b border-white/[0.06] bg-card/50 px-4">
      <Branding />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1 transition-colors hover:bg-white/[0.06]"
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
            {/* Status indicator badge */}
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                statusIndicator
                  ? cn(statusIndicator.bgColor, statusIndicator.textColor)
                  : "bg-muted text-muted-foreground"
              )}
            >
              {statusIndicator ? (
                <>
                  {isDefaultUser ? (
                    <Shield className="size-3.5" />
                  ) : (
                    <Clock className="size-3.5" />
                  )}
                  <span>{statusIndicator.text}</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="size-3.5" />
                  <span>Error</span>
                </>
              )}
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href="/sign-in-status">
              <User className="size-4" />
              Account status
            </Link>
          </DropdownMenuItem>
          {!isDefaultUser &&
            (isTokenExpired || isTokenExpiringSoon || tokenError) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleReauth}
                  className="cursor-pointer"
                >
                  <RefreshCw className="size-4" />
                  Re-authenticate
                </DropdownMenuItem>
              </>
            )}
          <DropdownMenuSeparator />
          {isDefaultUser ? (
            <DropdownMenuItem
              onClick={handleSwitchUser}
              className="cursor-pointer"
            >
              <ArrowRightLeft className="size-4" />
              Switch user
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              variant="destructive"
              onClick={handleSignOut}
              disabled={signingOut}
              className="cursor-pointer"
            >
              <LogOut className="size-4" />
              {signingOut ? "Signing out..." : "Sign out"}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
