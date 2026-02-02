"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EntityNameProps = {
  children: ReactNode;
  type?: "connector" | "rule" | "device" | "policy" | "default";
  className?: string;
};

export function EntityName({
  children,
  type: _type = "default",
  className,
}: EntityNameProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5",
        "bg-foreground/10 font-medium text-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}
