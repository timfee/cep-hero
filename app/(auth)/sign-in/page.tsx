/**
 * Sign-in page with options to sign in with existing account or self-enroll.
 */

"use client";

import { track } from "@vercel/analytics";
import { AlertCircle, Loader2, Mail } from "lucide-react";
import Image from "next/image";
import { useActionState, useCallback, useState } from "react";

import { enrollUser, type EnrollmentResult } from "@/app/gimme/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth-client";

/**
 * Form state type for useActionState.
 */
type FormState = EnrollmentResult | null;

/**
 * Wrapper for the enrollUser action to work with useActionState.
 */
function enrollAction(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  return enrollUser(formData);
}

/**
 * Handle sign-in button click.
 */
function handleSignIn() {
  track("Sign In Clicked");
  signIn.social({ provider: "google", callbackURL: "/" });
}

/**
 * Google icon SVG component.
 */
function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
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
  );
}

/**
 * Check email notification component - shown after enrollment request is processed.
 */
function CheckEmailNotice({
  email,
  onReset,
}: {
  email: string;
  onReset: () => void;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
            <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="text-blue-800 dark:text-blue-200">
              Check Your Email
            </AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              We&apos;ve sent a notification to <strong>{email}</strong> with
              the details of your request.
            </AlertDescription>
          </Alert>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onReset}
          >
            Submit Another Request
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Registration form component.
 */
function RegistrationForm() {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    enrollAction,
    null
  );
  const [formKey, setFormKey] = useState(0);

  const handleReset = useCallback(() => {
    setFormKey((prev) => prev + 1);
  }, []);

  if (state?.notificationSentTo) {
    return (
      <CheckEmailNotice
        email={state.notificationSentTo}
        onReset={handleReset}
      />
    );
  }

  return (
    <Card key={formKey}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Create an Account</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Full Name
            </label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="John Doe"
              required
              disabled={isPending}
              autoComplete="name"
              className="border-border bg-background"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Google Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="username@google.com"
              required
              disabled={isPending}
              autoComplete="email"
              className="border-border bg-background"
            />
            <p className="text-xs text-muted-foreground">
              Must end with @google.com
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Enrollment Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Enter enrollment password"
              required
              disabled={isPending}
              autoComplete="off"
              className="border-border bg-background"
            />
            <p className="text-xs text-muted-foreground">
              Contact your team lead for the enrollment password.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Sign-in page component with sign-in button and registration form.
 */
export default function SignInPage() {
  const onSignIn = useCallback(handleSignIn, []);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* Branding */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
            <Image src="/icon.png" alt="CEP Hero" height={50} width={50} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">CEP Hero</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Agentic CEP assistant demo
          </p>
        </div>

        {/* Sign In Button */}
        <div className="space-y-3">
          <Button className="w-full" size="lg" onClick={onSignIn}>
            <GoogleIcon />
            Sign in with Google
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Requires a Google Workspace admin account with Chrome management
            permissions.
          </p>
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or register for access
            </span>
          </div>
        </div>

        {/* Registration Form */}
        <RegistrationForm />
      </div>
    </main>
  );
}
