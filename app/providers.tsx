"use client";

import { ActivityLogProvider } from "@/components/activity-log-provider";
import { ChatProvider } from "@/components/chat/chat-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      <ActivityLogProvider>{children}</ActivityLogProvider>
    </ChatProvider>
  );
}

export { useActivityLog } from "@/components/activity-log-provider";
