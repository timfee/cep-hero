"use client";

import { ArrowRight, MessageSquare, LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ChatConsole } from "@/components/chat/chat-console";
import { useChatContext } from "@/components/chat/chat-context";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { clientFetch } from "@/lib/http";
import {
  type OverviewData,
  normalizeOverview,
  createDefaultOverview,
  DEFAULT_SUGGESTIONS,
  QUICK_ACTIONS,
} from "@/lib/overview";

export default function Home() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, signOut } = useAuth();
  const { sendMessage, setInput } = useChatContext();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [dataReady, setDataReady] = useState(false);

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/sign-in");
    }
  }, [isLoading, isAuthenticated, router]);

  // Fetch overview data
  useEffect(() => {
    if (!isAuthenticated) return;

    let active = true;
    async function load() {
      try {
        const res = await clientFetch("/api/overview");
        if (!res.ok) throw new Error(`overview ${res.status}`);
        const data = await res.json();
        if (!active) return;
        setOverview(normalizeOverview(data) ?? createDefaultOverview());
        setDataReady(true);
      } catch {
        if (!active) return;
        setOverview(createDefaultOverview());
        setDataReady(true);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const suggestions = useMemo(() => {
    if (overview?.suggestions?.length) return overview.suggestions;
    return [...DEFAULT_SUGGESTIONS];
  }, [overview]);

  const dispatchCommand = (command: string) => {
    setInput("");
    void sendMessage({ text: command });
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace("/sign-in");
    } catch {
      // Error handled by hook
    }
  };

  // Show loading state
  if (isLoading || !isAuthenticated || !dataReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="relative z-10 flex flex-col items-center gap-6">
          {/* Animated logo/brand mark */}
          <div className="relative">
            <div className="h-12 w-12 rounded-xl bg-muted animate-pulse" />
            <div className="absolute inset-0 h-12 w-12 rounded-xl border border-primary animate-ping opacity-20" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">
              CEP Command Center
            </h1>
            <p className="text-sm text-muted-foreground">Initializing...</p>
          </div>
        </div>
      </main>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8 xl:px-12 xl:py-10">
        {/* Header with User Info */}
        <header className="mb-6 flex items-start justify-between lg:mb-8 xl:mb-10">
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              CEP Command Center
            </h1>
            <p className="text-sm text-muted-foreground">
              Chrome Enterprise Premium diagnostics and remediation
            </p>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                {user.image ? (
                  <img
                    src={user.image}
                    alt=""
                    className="h-6 w-6 rounded-full"
                  />
                ) : (
                  <User className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm text-foreground">
                  {user.name || user.email}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                aria-label="Sign out"
                className="hover:bg-muted"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </header>

        {/* Main Layout */}
        <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:gap-8 xl:grid-cols-[1fr_380px] xl:gap-10">
          {/* Primary: Chat Console */}
          <div className="min-h-[600px] lg:min-h-[700px]">
            <ChatConsole />
          </div>

          {/* Sidebar */}
          <aside className="space-y-5 lg:space-y-6 xl:space-y-8">
            {/* Quick Actions */}
            <section>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Quick Actions
              </h2>
              <div className="space-y-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => dispatchCommand(action.label)}
                    className="group flex w-full cursor-pointer items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:border-foreground/20 hover:bg-accent lg:px-5 lg:py-4"
                  >
                    <div>
                      <span className="text-sm font-medium text-foreground">
                        {action.label}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {action.description}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </section>

            {/* Suggestions */}
            <section>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Suggested Prompts
              </h2>
              <div className="space-y-1">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => dispatchCommand(suggestion)}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:px-4 lg:py-2.5"
                  >
                    <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{suggestion}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Status Summary */}
            {overview && overview.postureCards.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Fleet Status
                </h2>
                <div className="rounded-lg border border-border bg-card p-4 lg:p-5">
                  <div className="grid grid-cols-2 gap-4 lg:gap-5">
                    {overview.postureCards.slice(0, 4).map((card) => (
                      <button
                        key={card.label}
                        onClick={() => dispatchCommand(card.action)}
                        className="cursor-pointer text-left transition-colors hover:opacity-70"
                      >
                        <div className="text-2xl font-semibold text-foreground">
                          {card.value}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {card.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
