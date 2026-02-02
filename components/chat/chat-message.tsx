"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ChatMessageProps = {
  children: ReactNode;
  className?: string;
};

export function ChatMessage({ children, className }: ChatMessageProps) {
  return <div className={cn("w-full", className)}>{children}</div>;
}
