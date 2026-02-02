"use client";

import { useState, useCallback } from "react";

import { ChatConsole } from "./chat-console";
import { DashboardOverview } from "./dashboard-overview";

const commandPrompts: Record<
  string,
  (params?: Record<string, string>) => string
> = {
  diagnoseConnectors: () =>
    "Run diagnostics on all connectors that are not healthy and provide recommendations to fix them.",
  listNonCompliantDevices: () =>
    "Show me all non-compliant devices and explain what policies they are violating.",
  reviewDLPAlerts: () =>
    "Review recent DLP alerts and show me the most critical incidents that need attention.",
  investigateThreat: () =>
    "Investigate the active security threat and provide detailed analysis with remediation steps.",
  fixConnector: (params) =>
    `Diagnose and fix the connector ${params?.connectorId || ""}. Show me what issues it has and guide me through fixing them.`,
  renewCertificate: (params) =>
    `The certificate for connector ${params?.connectorId || ""} needs renewal. Guide me through the renewal process.`,
  enableDLPRule: (params) =>
    `Enable the DLP rule ${params?.ruleId || ""}. Show me what it does and confirm it's been enabled.`,
  forcePolicySync: () =>
    "Force a policy sync for all stale devices that have not synced in the last 24 hours.",
  diagnoseConnector: (params) =>
    `Run a full diagnostic on connector ${params?.connectorId || ""} and show me any issues found.`,
};

export function AppShell() {
  const [chatPrompt, setChatPrompt] = useState<string | undefined>();

  const handleAction = useCallback(
    (command: string, parameters?: Record<string, string>) => {
      const promptGenerator = commandPrompts[command];
      if (promptGenerator) {
        const prompt = promptGenerator(parameters);
        setChatPrompt(prompt);
        setTimeout(() => setChatPrompt(undefined), 100);
      }
    },
    []
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <main className="hidden flex-1 lg:block">
        <DashboardOverview onAction={handleAction} />
      </main>

      <aside className="flex w-full flex-col border-l border-white/[0.06] lg:w-[560px]">
        <ChatConsole initialPrompt={chatPrompt} className="flex-1" />
      </aside>
    </div>
  );
}
