"use client";

import { Suspense } from "react";

import { ChatConsole } from "@/components/chat/chat-console";
import { ChatProvider, useChatContext } from "@/components/chat/chat-context";
import { DemoModeBanner } from "@/components/fixtures/demo-mode-banner";
import { FixtureSelector } from "@/components/fixtures/fixture-selector";
import { FixtureProvider } from "@/lib/fixtures/context";

import { DashboardOverview } from "./dashboard-overview";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { UserStatusBar } from "./user-status-bar";

/**
 * Main content area with dashboard and chat panels.
 * Uses Suspense boundary for the dashboard to enable streaming.
 */
function AppShellContent() {
  const { sendMessage } = useChatContext();

  const handleAction = (command: string) => {
    void sendMessage({ text: command });
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <UserStatusBar />
      <DemoModeBanner />

      <div className="flex flex-1 overflow-hidden">
        {/* Dashboard panel - hidden on mobile, visible on lg screens */}
        <main className="hidden flex-1 flex-col lg:flex">
          {/* Header with fixture selector */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-3">
            <h1 className="text-sm font-medium text-white/70">
              Fleet Overview
            </h1>
            <FixtureSelector />
          </div>
          <div className="flex-1 overflow-auto">
            <Suspense fallback={<DashboardSkeleton />}>
              <DashboardOverview onAction={handleAction} />
            </Suspense>
          </div>
        </main>

        {/* Chat panel - full width on mobile, fixed width on lg screens */}
        <aside className="flex w-full flex-col border-l border-white/[0.06] lg:w-[560px]">
          <ChatConsole />
        </aside>
      </div>
    </div>
  );
}

/**
 * Root application shell that provides fixture and chat context to all children.
 * FixtureProvider must wrap ChatProvider since ChatProvider consumes fixture context.
 */
export function AppShell() {
  return (
    <FixtureProvider>
      <ChatProvider>
        <AppShellContent />
      </ChatProvider>
    </FixtureProvider>
  );
}
