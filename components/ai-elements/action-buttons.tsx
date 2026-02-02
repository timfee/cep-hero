"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { memo } from "react";

export interface ActionItem {
  id: string;
  label?: string;
  command?: string;
  primary?: boolean;
}

export interface ActionButtonsProps {
  actions: ActionItem[];
  className?: string;
  onAction?: (command: string) => void;
}

export const ActionButtons = memo(function ActionButtons({
  actions,
  className,
  onAction,
}: ActionButtonsProps) {
  if (actions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {actions.map((action, i) => (
        <motion.div
          key={action.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
        >
          <Button
            size="sm"
            variant={action.primary ? "default" : "secondary"}
            className="h-8 text-xs"
            onClick={() => {
              const cmd = action.command ?? action.label ?? action.id;
              onAction?.(cmd);
            }}
          >
            {action.label ?? action.id}
          </Button>
        </motion.div>
      ))}
    </motion.div>
  );
});
