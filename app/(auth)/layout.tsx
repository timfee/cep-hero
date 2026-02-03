import type { Metadata } from "next";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

/**
 * Generate metadata for auth pages.
 * Uses the template from the root layout.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Sign In",
    description:
      "Sign in with your Google Workspace account to access Chrome Enterprise Premium diagnostics.",
    robots: {
      index: false,
      follow: false,
    },
  };
}

/**
 * Auth layout that provides shared structure for authentication pages.
 * Redirects authenticated users to the main app.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Redirect authenticated users away from auth pages
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    redirect("/");
  }

  return (
    <div className="relative min-h-screen">
      {/* Background gradient for auth pages */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative">{children}</div>
    </div>
  );
}
