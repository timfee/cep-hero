import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/cep/app-shell";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }
  return <AppShell />;
}
