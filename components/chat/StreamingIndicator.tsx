"use client";

import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { Message } from "@/components/ai-elements/message";

/**
 * Inline streaming indicator shown while waiting for the assistant's response.
 * Displays in the message area, not in the header.
 */
export function StreamingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <Message from="assistant">
        {/* Avatar and role label */}
        <div className="flex items-center gap-2">
          <motion.div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary"
            aria-hidden="true"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <Sparkles className="h-4 w-4" />
          </motion.div>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Assistant
          </span>
        </div>

        {/* Thinking indicator */}
        <div className="ml-10 flex items-center gap-2">
          <ThinkingDots />
          <motion.span
            className="text-sm text-muted-foreground"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            Analyzing...
          </motion.span>
        </div>
      </Message>
    </motion.div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-primary"
          animate={{
            y: [0, -4, 0],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
