/**
 * Root page component that serves as the main entry point.
 * Redirects unauthenticated users to sign-in and renders the app shell for authenticated users.
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/cep/app-shell";
import { auth } from "@/lib/auth";

/**
 * Home page that requires authentication to access.
 */
export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }
  return <AppShell />;
}
