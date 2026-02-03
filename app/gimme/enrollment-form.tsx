/**
 * Client component for the self-enrollment form with state management.
 */

"use client";

import { CheckCircle, AlertCircle, Loader2, Copy, Check } from "lucide-react";
import { useActionState, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { enrollUser, type EnrollmentResult } from "./actions";

/**
 * Form state type for useActionState.
 */
type FormState = EnrollmentResult | null;

/**
 * Wrapper for the enrollUser action to work with useActionState.
 */
async function enrollAction(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  return enrollUser(formData);
}

/**
 * Copy button component with feedback.
 */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="h-7 gap-1.5"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          Copy {label}
        </>
      )}
    </Button>
  );
}

/**
 * Success state display component.
 */
function SuccessResult({
  email,
  notificationSentTo,
  onReset,
}: {
  email: string;
  notificationSentTo: string;
  onReset: () => void;
}) {
  return (
    <div className="space-y-4">
      <Alert className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertTitle className="text-green-800 dark:text-green-200">
          Account Created Successfully
        </AlertTitle>
        <AlertDescription className="text-green-700 dark:text-green-300">
          Your super admin account has been created and credentials have been
          sent to your email.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              New Admin Email
            </label>
            <div className="mt-1 flex items-center justify-between gap-2 rounded-md border bg-muted/50 px-3 py-2">
              <code className="text-sm">{email}</code>
              <CopyButton text={email} label="email" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Credentials Sent To
            </label>
            <div className="mt-1 rounded-md border bg-muted/50 px-3 py-2">
              <code className="text-sm">{notificationSentTo}</code>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Check your inbox for the temporary password.
            </p>
          </div>

          <div className="rounded-md border bg-muted/30 p-3">
            <p className="mb-2 text-sm font-medium">Next Steps:</p>
            <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
              <li>Check your email for the temporary password</li>
              <li>Go to admin.google.com</li>
              <li>Sign in with your new admin email</li>
              <li>Change your password when prompted</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={onReset}
      >
        Create Another Account
      </Button>
    </div>
  );
}

/**
 * Enrollment form client component.
 */
export function EnrollmentForm() {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    enrollAction,
    null
  );
  const [formKey, setFormKey] = useState(0);

  function handleReset() {
    setFormKey((prev) => prev + 1);
  }

  if (state?.success) {
    return (
      <SuccessResult
        email={state.email}
        notificationSentTo={state.notificationSentTo}
        onReset={handleReset}
      />
    );
  }

  return (
    <Card key={formKey}>
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-4">
          {state && !state.success && (
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
            />
            <p className="text-xs text-muted-foreground">
              Contact your team lead for the enrollment password.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Account...
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
