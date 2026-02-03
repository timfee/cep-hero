"use client";

import { Clock, LogOut, RefreshCw, User, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

interface StatusState {
  loading: boolean;
  data: SignInStatusResponse | null;
  error: string | null;
}

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

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return "??";
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

  if (status.loading) {
    return (
      <div className="flex h-12 items-center gap-2 border-b border-white/[0.06] bg-card/50 px-4">
        <div className="size-6 animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!status.data?.authenticated || status.error) {
    return (
      <div className="flex h-12 items-center justify-between border-b border-white/[0.06] bg-card/50 px-4">
        <span className="text-sm text-muted-foreground">Not signed in</span>
        <Button size="sm" variant="outline" onClick={handleReauth}>
          <User className="size-4" />
          Sign in
        </Button>
      </div>
    );
  }

  const { user, token, error: tokenError } = status.data;
  const displayName = user?.name ?? user?.email ?? "User";
  const isTokenExpired = localExpiresIn !== null && localExpiresIn <= 0;
  const isTokenExpiringSoon = localExpiresIn !== null && localExpiresIn < 300;

  return (
    <div className="flex h-12 items-center justify-between border-b border-white/[0.06] bg-card/50 px-4">
      <div className="flex items-center gap-3">
        <Avatar size="sm">
          {user?.image && <AvatarImage src={user.image} alt={displayName} />}
          <AvatarFallback>
            {getInitials(user?.name ?? null, user?.email ?? null)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-sm font-medium leading-none">
            {displayName}
          </span>
          {user?.email && user.email !== displayName && (
            <span className="text-xs text-muted-foreground">{user.email}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {tokenError ? (
          <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
            <AlertTriangle className="size-3" />
            <span>Token error</span>
          </div>
        ) : token && localExpiresIn !== null ? (
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs",
              isTokenExpired
                ? "bg-destructive/10 text-destructive"
                : isTokenExpiringSoon
                  ? "bg-yellow-500/10 text-yellow-500"
                  : "bg-muted text-muted-foreground"
            )}
          >
            <Clock className="size-3" />
            <span>
              {isTokenExpired ? "Expired" : formatTimeRemaining(localExpiresIn)}
            </span>
          </div>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Account menu"
              title="Account menu"
            >
              <User className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Account</DropdownMenuLabel>
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
    </div>
  );
}
