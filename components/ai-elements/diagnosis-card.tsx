/**
 * Diagnosis card component for displaying AI diagnostic conclusions.
 * Shows diagnosis text with optional reference link to documentation.
 */
"use client";

import { Stethoscope, BookOpen } from "lucide-react";
import { motion } from "motion/react";
import { memo } from "react";

import type { Reference } from "@/types/chat";

import { cn } from "@/lib/utils";

export interface DiagnosisCardProps {
  diagnosis: string;
  reference?: Reference | null;
  className?: string;
}

/**
 * Animated card displaying a diagnosis with stethoscope icon and optional documentation link.
 */
export const DiagnosisCard = memo(function DiagnosisCard({
  diagnosis,
  reference,
  className,
}: DiagnosisCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg border border-primary/20 bg-primary/5 p-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Stethoscope className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-primary uppercase tracking-wider mb-1">
            Diagnosis
          </p>
          <p className="text-sm text-foreground leading-relaxed">{diagnosis}</p>

          {reference && reference.url && (
            <a
              href={reference.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{reference.title}</span>
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
});
