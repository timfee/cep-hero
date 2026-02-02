"use client";

import { ActivityLogProvider } from "@/components/activity-log-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ActivityLogProvider>{children}</ActivityLogProvider>;
}

export { useActivityLog } from "@/components/activity-log-provider";
