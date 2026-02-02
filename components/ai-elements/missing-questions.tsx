"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { HelpCircle, MessageCircleQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MissingQuestion } from "@/types/chat";
import { memo } from "react";

export interface MissingQuestionCardProps {
  question: MissingQuestion;
  index?: number;
}

export const MissingQuestionCard = memo(function MissingQuestionCard({
  question,
  index = 0,
}: MissingQuestionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="rounded-lg border border-primary/20 bg-primary/5 p-3"
    >
      <div className="flex items-start gap-2">
        <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {question.question}
          </p>
          {question.why && (
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-medium">Why:</span> {question.why}
            </p>
          )}
          {question.example && (
            <p className="mt-1 text-xs italic text-muted-foreground/80">
              Example: {question.example}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
});

export interface MissingQuestionsListProps {
  questions: MissingQuestion[];
  className?: string;
}

export const MissingQuestionsList = memo(function MissingQuestionsList({
  questions,
  className,
}: MissingQuestionsListProps) {
  if (questions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn("space-y-2", className)}
    >
      <div className="flex items-center gap-2">
        <HelpCircle className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Need from you
        </span>
        <Badge variant="secondary" className="text-xs">
          {questions.length}
        </Badge>
      </div>

      <div className="space-y-2">
        {questions.map((q, i) => (
          <MissingQuestionCard key={i} question={q} index={i} />
        ))}
      </div>
    </motion.div>
  );
});
