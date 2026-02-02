"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { HelpCircle, ChevronDown, MessageCircleQuestion } from "lucide-react";
import type { ComponentProps } from "react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import type { MissingQuestion } from "@/types/chat";

export type QuestionCardProps = {
  question: MissingQuestion;
  index?: number;
};

export function QuestionCard({ question, index = 0 }: QuestionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-md border border-primary/20 bg-primary/5 p-2"
    >
      <div className="flex items-start gap-2">
        <HelpCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground">
            {question.question}
          </p>
          {question.why && (
            <p className="text-xs text-muted-foreground">Why: {question.why}</p>
          )}
          {question.example && (
            <p className="text-xs italic text-muted-foreground/70">
              Example: {question.example}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export type QuestionsPanelProps = ComponentProps<"div"> & {
  questions: MissingQuestion[];
  defaultOpen?: boolean;
};

export function QuestionsPanel({
  questions,
  defaultOpen = true,
  className,
  ...props
}: QuestionsPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (!questions?.length) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-left transition-colors hover:bg-muted/50",
          className
        )}
        {...props}
      >
        <MessageCircleQuestion className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-xs font-medium text-foreground">
          Questions for you
        </span>
        <Badge variant="secondary" className="text-xs">
          {questions.length}
        </Badge>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-2 space-y-2 rounded-lg border border-border bg-muted/30 p-3"
        >
          {questions.map((q, i) => (
            <QuestionCard key={i} question={q} index={i} />
          ))}
        </motion.div>
      </CollapsibleContent>
    </Collapsible>
  );
}
