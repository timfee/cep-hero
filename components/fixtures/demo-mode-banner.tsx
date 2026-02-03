"use client";

import { FlaskConical, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFixtureContext } from "@/lib/fixtures/context";

/**
 * Banner displayed at the top of the app when a fixture scenario is active.
 * Shows the scenario name and provides a way to exit demo mode.
 */
export function DemoModeBanner() {
  const { activeFixture, clearFixture, isFixtureMode } = useFixtureContext();

  if (!isFixtureMode || !activeFixture) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-amber-200">
      <div className="flex items-center gap-3">
        <FlaskConical className="size-4 text-amber-400" />
        <span className="text-sm font-medium">
          Demo Mode:{" "}
          <span className="text-amber-100">{activeFixture.title}</span>
        </span>
        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs capitalize text-amber-300">
          {activeFixture.category}
        </span>
      </div>
      <Button
        variant="ghost"
        size="xs"
        onClick={clearFixture}
        className="text-amber-300 hover:bg-amber-500/20 hover:text-amber-100"
      >
        <X className="size-3" />
        Exit
      </Button>
    </div>
  );
}
