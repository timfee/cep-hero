/**
 * Client component for the self-enrollment form with state management.
 */

"use client";

import { Mail, AlertCircle, Loader2 } from "lucide-react";
import { useActionState, useState, useCallback } from "react";

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
function enrollAction(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  return enrollUser(formData);
}

/**
 * Check email notification component - shown after request is processed.
 */
function CheckEmailNotice({
  email,
  onReset,
}: {
  email: string;
  onReset: () => void;
}) {
  return (
    <div className="space-y-4">
      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
        <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-blue-800 dark:text-blue-200">
          Check Your Email
        </AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          We&apos;ve sent a notification to <strong>{email}</strong> with the
          details of your request.
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

  const handleReset = useCallback(() => {
    setFormKey((prev) => prev + 1);
  }, []);

  // Show "check your email" when notification was sent (regardless of outcome)
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
      <CardContent className="pt-6">
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
                Processing...
              </>
            ) : (
              "Submit Request"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
