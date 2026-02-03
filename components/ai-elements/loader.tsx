"use client";

import type { HTMLAttributes } from "react";

import { motion } from "motion/react";

import { cn } from "@/lib/utils";

export type LoaderProps = HTMLAttributes<HTMLDivElement> & {
  size?: number;
  variant?: "spinner" | "pulse" | "dots";
};

const PulseLoader = ({ size = 16 }: { size: number }) => (
  <motion.div
    className="rounded-full bg-current"
    style={{ width: size, height: size }}
    animate={{
      scale: [1, 1.2, 1],
      opacity: [0.6, 1, 0.6],
    }}
    transition={{
      duration: 1.2,
      repeat: Infinity,
      ease: "easeInOut",
    }}
  />
);

const DotsLoader = ({ size = 16 }: { size: number }) => {
  const dotSize = size / 4;
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="rounded-full bg-current"
          style={{ width: dotSize, height: dotSize }}
          animate={{
            y: [0, -dotSize, 0],
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
};

const SpinnerLoader = ({ size = 16 }: { size: number }) => (
  <motion.svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    animate={{ rotate: 360 }}
    transition={{
      duration: 1,
      repeat: Infinity,
      ease: "linear",
    }}
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="2"
      strokeOpacity="0.2"
    />
    <motion.circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="62.83"
      animate={{
        strokeDashoffset: [62.83, 0],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  </motion.svg>
);

export const Loader = ({
  className,
  size = 16,
  variant = "spinner",
  ...props
}: LoaderProps) => (
  <div
    className={cn("inline-flex items-center justify-center", className)}
    {...props}
  >
    {variant === "pulse" && <PulseLoader size={size} />}
    {variant === "dots" && <DotsLoader size={size} />}
    {variant === "spinner" && <SpinnerLoader size={size} />}
  </div>
);

export const PulsePillIndicator = ({
  className,
  label = "Working",
}: {
  className?: string;
  label?: string;
}) => (
  <div
    className={cn(
      "inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary",
      className
    )}
    aria-live="polite"
    aria-label={label}
  >
    <motion.span
      className="inline-flex h-2.5 w-2.5 rounded-full bg-primary"
      animate={{ scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
    />
    <span>{label}</span>
  </div>
);

// Thinking indicator with animated text
export const ThinkingIndicator = ({
  className,
  message = "Thinking",
}: {
  className?: string;
  message?: string;
}) => (
  <div className={cn("flex items-center gap-2", className)}>
    <Loader size={14} variant="dots" className="text-primary" />
    <motion.span
      className="text-sm text-muted-foreground"
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
    >
      {message}
    </motion.span>
  </div>
);

// Skeleton loader for content
export const ContentSkeleton = ({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) => (
  <div className={cn("space-y-2", className)}>
    {Array.from({ length: lines }).map((_, i) => (
      <motion.div
        key={i}
        className="h-4 rounded bg-muted"
        style={{ width: i === lines - 1 ? "60%" : "100%" }}
        animate={{
          opacity: [0.4, 0.7, 0.4],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          delay: i * 0.1,
          ease: "easeInOut",
        }}
      />
    ))}
  </div>
);
