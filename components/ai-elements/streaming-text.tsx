"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import type { ComponentProps } from "react";

export type StreamingTextProps = ComponentProps<"div"> & {
  text: string;
  isStreaming?: boolean;
};

/**
 * Displays streaming text with a subtle cursor animation when actively streaming.
 * When not streaming, renders as plain text.
 */
export function StreamingText({
  text,
  isStreaming = false,
  className,
  ...props
}: StreamingTextProps) {
  if (!text) return null;

  return (
    <div className={cn("relative", className)} {...props}>
      <span className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {text}
      </span>
      {isStreaming && (
        <motion.span
          className="ml-0.5 inline-block h-4 w-0.5 bg-primary"
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}

export type StreamingBlocksProps = ComponentProps<"div"> & {
  text: string;
  isStreaming?: boolean;
};

/**
 * Splits text into paragraphs and renders them with staggered animation.
 */
export function StreamingBlocks({
  text,
  isStreaming = false,
  className,
  ...props
}: StreamingBlocksProps) {
  if (!text) return null;

  const blocks = text.split(/\n{2,}/);

  return (
    <div className={cn("space-y-2", className)} {...props}>
      {blocks.map((block, idx) => (
        <motion.p
          key={idx}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: idx * 0.02 }}
          className="whitespace-pre-wrap text-sm leading-relaxed text-foreground"
        >
          {block}
          {isStreaming && idx === blocks.length - 1 && (
            <motion.span
              className="ml-0.5 inline-block h-4 w-0.5 bg-primary"
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </motion.p>
      ))}
    </div>
  );
}
