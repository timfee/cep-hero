"use client";

import { motion } from "motion/react";
import { memo } from "react";

import { cn } from "@/lib/utils";

export interface StreamingTextProps {
  text: string;
  isStreaming?: boolean;
  className?: string;
}

/**
 * Renders text with an optional streaming cursor indicator.
 * Splits text on double newlines into paragraphs for proper formatting.
 */
export const StreamingText = memo(function StreamingText({
  text,
  isStreaming = false,
  className,
}: StreamingTextProps) {
  const trimmedText = text.trim();
  const paragraphs = trimmedText.split(/\n{2,}/).filter(Boolean);
  const showEmptyStreamingState = isStreaming && trimmedText.length === 0;

  return (
    <div
      aria-busy={isStreaming}
      aria-live="polite"
      className={cn("space-y-3", className)}
    >
      {paragraphs.map((paragraph, i) => {
        const isLast = i === paragraphs.length - 1;

        return (
          <motion.p
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04, ease: "easeOut" }}
            className="whitespace-pre-wrap text-sm leading-relaxed text-foreground"
          >
            {paragraph}
            {isStreaming && isLast && <StreamingCursor />}
          </motion.p>
        );
      })}

      {/* Show cursor even when text is empty during streaming */}
      {showEmptyStreamingState && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 text-sm text-muted-foreground"
          role="status"
        >
          <ThinkingIndicator message="Gathering context..." />
          <StreamingCursor />
        </motion.div>
      )}
    </div>
  );
});

/**
 * Animated cursor that pulses to indicate active streaming.
 */
export const StreamingCursor = memo(function StreamingCursor() {
  return (
    <motion.span
      className="ml-0.5 inline-block h-4 w-0.5 align-middle bg-foreground/60"
      animate={{ opacity: [1, 0.3, 1] }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
    />
  );
});

export interface ThinkingIndicatorProps {
  message?: string;
  className?: string;
}

/**
 * Animated "thinking" indicator shown inline while waiting for response.
 */
export const ThinkingIndicator = memo(function ThinkingIndicator({
  message = "Thinking",
  className,
}: ThinkingIndicatorProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn("flex items-center gap-2", className)}
    >
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
            animate={{ y: [0, -3, 0], opacity: [0.3, 0.8, 0.3] }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      <span className="text-sm text-muted-foreground">{message}</span>
    </motion.div>
  );
});
