/**
 * Generates the chat panel's seed/welcome message based on fleet overview data.
 * Extracted to its own module so the logic is unit-testable independently
 * from the full ChatConsole component.
 */

import type { OverviewData } from "@/lib/overview";

const INTRO = "Hey there! I'm your Chrome Enterprise Premium assistant.";

/**
 * Generate a standalone welcome message for the chat panel.
 * This must NOT repeat the dashboard headline or summary since those are
 * already visible in the left panel.
 */
export function generateWelcomeMessage(data: OverviewData | null) {
  if (!data) {
    return `${INTRO} Ask me anything about your fleet, or use the suggestions below to get started.`;
  }

  const gaps: string[] = [];
  for (const card of data.postureCards) {
    if (card.status === "critical" || card.status === "warning") {
      gaps.push(card.label.toLowerCase());
    }
  }

  if (gaps.length > 0) {
    return `${INTRO} I noticed a few areas that could use attention — like ${gaps.join(" and ")}. Pick a suggestion below or ask me anything.`;
  }

  return `${INTRO} Everything's looking good on the dashboard. Pick a suggestion below or ask me anything.`;
}
