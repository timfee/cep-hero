"use client";

import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Authentication error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
          <AlertCircle className="h-6 w-6 text-red-400" />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-foreground">
          Sign in failed
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          We couldn&apos;t complete the sign in process. This might be a
          temporary issue or a problem with your Google Workspace account
          permissions.
        </p>
        {typeof error.digest === "string" && error.digest.length > 0 && (
          <p className="mb-4 font-mono text-xs text-muted-foreground">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href="/" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Home
            </Link>
          </Button>
          <Button onClick={reset} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
        </div>
      </div>
    </main>
  );
}
