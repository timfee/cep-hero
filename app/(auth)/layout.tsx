import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to CEP Hero with your Google Workspace account.",
  robots: { index: false, follow: false },
};

/**
 * Auth layout - wraps sign-in page with styling.
 * Does NOT redirect authenticated users to avoid race conditions during sign-out.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
