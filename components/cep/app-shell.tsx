/**
 * Application shell providing the main two-panel layout with dashboard and chat.
 * Wraps content in a ChatProvider for shared state management across panels.
 */

"use client";

import { motion } from "framer-motion";
import { Suspense } from "react";

import { ChatConsole } from "@/components/chat/chat-console";
import { ChatProvider, useChatContext } from "@/components/chat/chat-context";
import { DemoModeBanner } from "@/components/fixtures/demo-mode-banner";
import { FixtureSelector } from "@/components/fixtures/fixture-selector";
import { ResizablePanels } from "@/components/ui/resizable-panels";
import { FixtureProvider } from "@/lib/fixtures/context";

import {
  DashboardLoadProvider,
  useDashboardLoad,
} from "./dashboard-load-context";
import { DashboardOverview } from "./dashboard-overview";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { UserStatusBar } from "./user-status-bar";

/**
 * Dashboard panel component for the left side of the layout.
 */
function DashboardPanel({ onAction }: { onAction: (command: string) => void }) {
  return (
    <main className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-3">
        <h1 className="text-sm font-medium text-white/70">Fleet Overview</h1>
        <FixtureSelector />
      </div>
      <div className="flex-1 overflow-auto">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardOverview onAction={onAction} />
        </Suspense>
      </div>
    </main>
  );
}

/**
 * Chat panel component with slide-in animation.
 * Container stays in place - only content animates to prevent layout shifts.
 */
function ChatPanel() {
  const { isDashboardLoaded } = useDashboardLoad();

  return (
    <aside className="flex h-full flex-col overflow-hidden">
      <motion.div
        className="flex h-full flex-col"
        initial={{ x: 40, opacity: 0 }}
        animate={{
          x: isDashboardLoaded ? 0 : 40,
          opacity: isDashboardLoaded ? 1 : 0,
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30,
          delay: isDashboardLoaded ? 0.1 : 0,
        }}
      >
        <ChatConsole />
      </motion.div>
    </aside>
  );
}

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

      {/* Mobile layout - chat only */}
      <div className="flex flex-1 overflow-hidden lg:hidden">
        <aside className="flex w-full flex-col">
          <ChatConsole />
        </aside>
      </div>

      {/* Desktop layout - resizable panels */}
      <div className="hidden flex-1 overflow-hidden lg:flex">
        <ResizablePanels
          defaultLeftWidth={60}
          minLeftWidth={30}
          maxLeftWidth={75}
          storageKey="cep-hero-panel-width"
        >
          <DashboardPanel onAction={handleAction} />
          <ChatPanel />
        </ResizablePanels>
      </div>
    </div>
  );
}

/**
 * Root application shell that provides fixture and chat context to all children.
 * FixtureProvider must wrap ChatProvider since ChatProvider consumes fixture context.
 * DashboardLoadProvider coordinates timing between dashboard load and chat animation.
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
