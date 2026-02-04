/**
 * Application shell providing the main two-panel layout with dashboard and chat.
 */

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Suspense } from "react";

import { ChatConsole } from "@/components/chat/chat-console";
import { ChatProvider, useChatContext } from "@/components/chat/chat-context";
import { DemoModeBanner } from "@/components/fixtures/demo-mode-banner";
import { FixtureSelector } from "@/components/fixtures/fixture-selector";
import { FixtureProvider } from "@/lib/fixtures/context";

import {
  DashboardLoadProvider,
  useDashboardLoad,
} from "./dashboard-load-context";
import { DashboardOverview } from "./dashboard-overview";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { UserStatusBar } from "./user-status-bar";

/**
 * Main content area with dashboard and chat panels.
 */
function AppShellContent() {
  const { sendMessage } = useChatContext();
  const { isDashboardLoaded } = useDashboardLoad();

  const handleAction = (command: string) => {
    void sendMessage({ text: command });
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <UserStatusBar />
      <DemoModeBanner />

      {/* Mobile layout - chat only */}
      <div className="flex flex-1 overflow-hidden lg:hidden">
        <aside className="flex w-full flex-col">
          <ChatConsole />
        </aside>
      </div>

      {/* Desktop layout */}
      <div className="hidden flex-1 overflow-hidden lg:flex">
        {/* Dashboard - full width until chat loads */}
        <main className="flex h-full flex-1 flex-col">
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

        {/* Chat panel - slides in from right when dashboard loads */}
        <AnimatePresence>
          {isDashboardLoaded && (
            <motion.aside
              className="flex h-full w-[500px] shrink-0 flex-col border-l border-white/[0.06]"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <ChatConsole />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Root application shell with providers.
 */
export function AppShell() {
  return (
    <FixtureProvider>
      <DashboardLoadProvider>
        <ChatProvider>
          <AppShellContent />
        </ChatProvider>
      </DashboardLoadProvider>
    </FixtureProvider>
  );
}
