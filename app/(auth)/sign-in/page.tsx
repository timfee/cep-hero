"use client";

import { Chrome, Lock } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const [isLoading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
      fetchOptions: {
        onRequest: () => {
          setLoading(true);
        },
        onResponse: () => {
          setLoading(false);
        },
      },
    });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo and Title */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
            <Image src="/icon.png" alt="CEP Hero" height="50" width="50" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">CEP Hero</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chrome Enterprise Premium diagnostics
          </p>
        </div>

        {/* Sign In Card */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-6">
            <h2 className="text-base font-medium text-foreground">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in with your Google Workspace account to access enterprise
              diagnostics.
            </p>
          </div>

          {/* Google Sign In Button */}
          <Button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            <svg
              className="mr-2 h-4 w-4"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>

          {/* Required Scopes Info */}
          <div className="mt-6 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">
              Required permissions:
            </p>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <Chrome className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>Chrome management and reporting access</span>
              </li>
              <li className="flex items-start gap-2">
                <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>Cloud Identity policies and audit logs</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Only Google Workspace admin accounts with appropriate permissions can
          sign in.
        </p>
      </div>
    </main>
  );
}
