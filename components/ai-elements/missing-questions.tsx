"use client";

import { cn } from "@/lib/utils";
import { HelpCircle } from "lucide-react";
import type { MissingQuestion } from "@/types/chat";
import { memo } from "react";

export interface MissingQuestionCardProps {
  question: MissingQuestion;
}

export const MissingQuestionCard = memo(function MissingQuestionCard({
  question,
}: MissingQuestionCardProps) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <p className="text-sm text-foreground">{question.question}</p>
      {question.why && (
        <p className="mt-1 text-xs text-muted-foreground">{question.why}</p>
      )}
    </div>
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
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <HelpCircle className="h-3.5 w-3.5" />
        <span>Questions ({questions.length})</span>
      </div>
      <div className="space-y-2">
        {questions.map((q, i) => (
          <MissingQuestionCard key={i} question={q} />
        ))}
      </div>
    </div>
  );
});
