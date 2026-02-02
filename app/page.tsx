"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AppShell } from "@/components/cep/app-shell";
import { useAuth } from "@/hooks/use-auth";

export default function Home() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/sign-in");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="relative">
            <div className="h-12 w-12 animate-pulse rounded-xl bg-muted" />
            <div className="absolute inset-0 h-12 w-12 animate-ping rounded-xl border border-primary opacity-20" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">
              CEP Assistant
            </h1>
            <p className="text-sm text-muted-foreground">Initializing...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <AppShell />;
}
