"use client";

import { ChatConsole } from "@/components/chat/chat-console";
import { ChatProvider, useChatContext } from "@/components/chat/chat-context";

import { DashboardOverview } from "./dashboard-overview";

function AppShellContent() {
  const { sendMessage } = useChatContext();

  const handleAction = (command: string) => {
    void sendMessage({ text: command });
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <main className="hidden flex-1 lg:block">
        <DashboardOverview onAction={handleAction} />
      </main>

      <aside className="flex w-full flex-col border-l border-white/[0.06] lg:w-[560px]">
        <ChatConsole />
      </aside>
    </div>
  );
}

export function AppShell() {
  return (
    <ChatProvider>
      <AppShellContent />
    </ChatProvider>
  );
}
