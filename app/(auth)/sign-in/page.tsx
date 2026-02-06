/**
 * Sign-in page with side-by-side sign-in and self-enrollment options.
 */

"use client";

import { track } from "@vercel/analytics";
import {
  AlertCircle,
  Loader2,
  Mail,
  Monitor,
  TriangleAlert,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState, useTransition } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth-client";
import { enrollUser } from "@/lib/gimme/actions";
import {
  ALLOWED_EMAIL_SUFFIX,
  MAX_NAME_LENGTH,
  TARGET_DOMAIN,
} from "@/lib/gimme/constants";

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
 * Check email notification shown after enrollment request is processed.
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
 * Client-side validation errors.
 */
interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

/**
 * Validate form fields on the client side.
 */
function validateFields(
  name: string,
  email: string,
  password: string
): FieldErrors {
  const errors: FieldErrors = {};

  const trimmedName = name.trim();
  if (!trimmedName) {
    errors.name = "Name is required";
  } else if (trimmedName.length > MAX_NAME_LENGTH) {
    errors.name = `Name must be ${MAX_NAME_LENGTH} characters or less`;
  }

  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail) {
    errors.email = "Email is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.email = "Invalid email format";
  } else if (!trimmedEmail.endsWith(ALLOWED_EMAIL_SUFFIX)) {
    errors.email = "Email must end with @google.com";
  }

  if (!password) {
    errors.password = "Enrollment password is required";
  }

  return errors;
}

/**
 * Registration form with client-side validation and value persistence.
 */
function RegistrationForm() {
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const errors = validateFields(name, email, password);
      setFieldErrors(errors);

      if (Object.keys(errors).length > 0) {
        return;
      }

      setServerError(null);

      const formData = new FormData();
      formData.set("name", name.trim());
      formData.set("email", email.trim().toLowerCase());
      formData.set("password", password);

      startTransition(async () => {
        const result = await enrollUser(formData);

        if (result.error) {
          setServerError(result.error);
        } else if (result.notificationSentTo) {
          setSuccessEmail(result.notificationSentTo);
        }
      });
    },
    [name, email, password]
  );

  const handleReset = useCallback(() => {
    setSuccessEmail(null);
    setServerError(null);
    setFieldErrors({});
    setName("");
    setEmail("");
    setPassword("");
  }, []);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setName(e.target.value);
      if (fieldErrors.name) {
        setFieldErrors((prev) => ({ ...prev, name: undefined }));
      }
    },
    [fieldErrors.name]
  );

  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEmail(e.target.value);
      if (fieldErrors.email) {
        setFieldErrors((prev) => ({ ...prev, email: undefined }));
      }
    },
    [fieldErrors.email]
  );

  const handlePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPassword(e.target.value);
      if (fieldErrors.password) {
        setFieldErrors((prev) => ({ ...prev, password: undefined }));
      }
    },
    [fieldErrors.password]
  );

  if (successEmail) {
    return <CheckEmailNotice email={successEmail} onReset={handleReset} />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {serverError && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium">
          Full Name
        </label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="John Doe"
          value={name}
          onChange={handleNameChange}
          disabled={isPending}
          autoComplete="name"
          aria-invalid={!!fieldErrors.name}
          className="border-border bg-background"
        />
        {fieldErrors.name && (
          <p className="text-xs text-destructive">{fieldErrors.name}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          Google Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="username@google.com"
          value={email}
          onChange={handleEmailChange}
          disabled={isPending}
          autoComplete="email"
          aria-invalid={!!fieldErrors.email}
          className="border-border bg-background"
        />
        {fieldErrors.email ? (
          <p className="text-xs text-destructive">{fieldErrors.email}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Must end with @google.com
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          Enrollment Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="Ask feel@ for this!"
          value={password}
          onChange={handlePasswordChange}
          disabled={isPending}
          autoComplete="off"
          aria-invalid={!!fieldErrors.password}
          className="border-border bg-background"
        />
        {fieldErrors.password && (
          <p className="text-xs text-destructive">{fieldErrors.password}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          "Request Account"
        )}
      </Button>
    </form>
  );
}

/**
 * Timeout duration before resetting the sign-in loading state.
 * Allows retry if popup is blocked or user cancels.
 */
const SIGNIN_TIMEOUT_MS = 10_000;

/**
 * Sign-in page with side-by-side sign-in and self-enrollment cards.
 */
export default function SignInPage() {
  const [isSigningIn, setIsSigningIn] = useState(false);

  const onSignIn = useCallback(() => {
    setIsSigningIn(true);
    handleSignIn();
  }, []);

  // Reset loading state after timeout to allow retry if sign-in fails
  useEffect(() => {
    if (!isSigningIn) {
      return;
    }

    const timeout = setTimeout(() => {
      setIsSigningIn(false);
    }, SIGNIN_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [isSigningIn]);

  return (
    <main className="isolate relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8">
      {/* Animated gradient background */}
      <div className="animate-gradient-shift absolute inset-0 z-0 bg-[length:400%_400%] bg-[linear-gradient(135deg,oklch(0.06_0.02_255),oklch(0.10_0.04_250),oklch(0.07_0.03_265),oklch(0.12_0.05_245),oklch(0.06_0.02_255))]" />
      <div className="animate-gradient-shift-reverse absolute inset-0 z-0 bg-[length:300%_300%] bg-[radial-gradient(ellipse_80%_60%_at_top_right,oklch(0.15_0.06_250/0.4),transparent_50%),radial-gradient(ellipse_60%_80%_at_bottom_left,oklch(0.14_0.05_270/0.3),transparent_50%)]" />

      <div className="relative z-10 w-full max-w-3xl space-y-6">
        {/* Branding */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
            <Image
              src="/icon.png"
              alt="CEP Hero"
              height={50}
              width={50}
              priority
            />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">CEP Hero</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Internal POC playground for Chrome Enterprise
          </p>
        </div>

        {/* Test domain warning */}
        <div className="mx-auto flex max-w-lg items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          <TriangleAlert
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
            aria-hidden="true"
          />
          <p>
            This tool uses a test domain (
            <strong className="font-semibold text-amber-100">
              {TARGET_DOMAIN}
            </strong>
            ) for live data access. Your @google.com credentials won&apos;t work
            here&mdash;you need a{" "}
            <strong className="font-semibold text-amber-100">
              {TARGET_DOMAIN}
            </strong>{" "}
            test account.
          </p>
        </div>

        {/* Side-by-side cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Sign In */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sign In</CardTitle>
              <CardDescription>
                Already have a {TARGET_DOMAIN} account?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                className="w-full"
                size="lg"
                onClick={onSignIn}
                disabled={isSigningIn}
              >
                {isSigningIn ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <GoogleIcon />
                    Sign in with {TARGET_DOMAIN}
                  </>
                )}
              </Button>
              <div className="flex items-start gap-2.5 rounded-md border border-blue-500/30 bg-blue-950/20 px-3 py-2.5 text-xs text-blue-200">
                <Monitor
                  className="mt-0.5 h-4 w-4 shrink-0 text-blue-400"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-medium text-blue-100">
                    Use a separate Chrome profile
                  </p>
                  <p className="mt-0.5">
                    Create a dedicated Chrome profile for your {TARGET_DOMAIN}{" "}
                    account to avoid conflicts with your corp profile.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Get an Account */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Get an Account</CardTitle>
              <CardDescription>
                Enter your @google.com email and the enrollment password to get
                a {TARGET_DOMAIN} account issued automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RegistrationForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
