"use client";

import { Suspense } from "react";

import { ChatConsole } from "@/components/chat/chat-console";
import { ChatProvider, useChatContext } from "@/components/chat/chat-context";

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
      {/* User status bar at top */}
      <UserStatusBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Dashboard panel - hidden on mobile, visible on lg screens */}
        <main className="hidden flex-1 lg:block">
          <Suspense fallback={<DashboardSkeleton />}>
            <DashboardOverview onAction={handleAction} />
          </Suspense>
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
 * Root application shell that provides chat context to all children.
 * This is a client component because it manages interactive chat state.
 */
export function AppShell() {
  return (
    <ChatProvider>
      <AppShellContent />
    </ChatProvider>
  );
}
