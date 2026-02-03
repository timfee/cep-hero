"use client";

import type { CSSProperties, ElementType, JSX } from "react";

import { motion } from "motion/react";
import { memo, useMemo } from "react";

import { cn } from "@/lib/utils";

export interface TextShimmerProps {
  children: string;
  as?: ElementType;
  className?: string;
  duration?: number;
  spread?: number;
}

const ShimmerComponent = ({
  children,
  as: Component = "p",
  className,
  duration = 2,
  spread = 2,
}: TextShimmerProps) => {
  const MotionComponent = motion.create(
    Component as keyof JSX.IntrinsicElements
  );

  const dynamicSpread = useMemo(
    () => (children?.length ?? 0) * spread,
    [children, spread]
  );

  return (
    <MotionComponent
      animate={{ backgroundPosition: "0% center" }}
      className={cn(
        "relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent",
        "[--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--color-primary),#0000_calc(50%+var(--spread)))] [background-repeat:no-repeat,padding-box]",
        className
      )}
      initial={{ backgroundPosition: "100% center" }}
      style={
        {
          "--spread": `${dynamicSpread}px`,
          backgroundImage:
            "var(--bg), linear-gradient(var(--color-muted-foreground), var(--color-muted-foreground))",
        } as CSSProperties
      }
      transition={{
        repeat: Number.POSITIVE_INFINITY,
        duration,
        ease: [0.4, 0, 0.2, 1], // Custom easing for smoother animation
      }}
    >
      {children}
    </MotionComponent>
  );
};

export const Shimmer = memo(ShimmerComponent);

// Pulse shimmer variant for more subtle loading states
export interface PulseShimmerProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export const PulseShimmer = memo(
  ({ className, width = "100%", height = 16 }: PulseShimmerProps) => (
    <motion.div
      className={cn("rounded bg-muted", className)}
      style={{ width, height }}
      animate={{
        opacity: [0.4, 0.7, 0.4],
        scale: [1, 1.005, 1],
      }}
      transition={{
        duration: 1.8,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  )
);

PulseShimmer.displayName = "PulseShimmer";
