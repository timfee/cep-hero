/**
 * Root page component that serves as the main entry point.
 * Redirects unauthenticated users to sign-in, or renders the app shell
 * directly when USE_DEFAULT_USER is enabled.
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/cep/app-shell";
import { auth } from "@/lib/auth";
import { isDefaultUserEnabled } from "@/lib/default-user";

/**
 * Home page that requires authentication or default user mode to access.
 */
export default async function Home() {
  if (isDefaultUserEnabled()) {
    return <AppShell />;
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }
  return <AppShell />;
}
