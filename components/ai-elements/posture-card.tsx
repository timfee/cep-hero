"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { memo } from "react";

export interface PostureCardData {
  label: string;
  value: string;
  note: string;
  source: string;
  action: string;
  lastUpdated?: string;
}

export interface PostureCardProps {
  card: PostureCardData;
  className?: string;
  index?: number;
  onAction?: (action: string) => void;
}

export const PostureCard = memo(function PostureCard({
  card,
  className,
  index = 0,
  onAction,
}: PostureCardProps) {
  const formattedDate = card.lastUpdated
    ? new Date(card.lastUpdated).toLocaleString()
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card
        className={cn(
          "border-border bg-card transition-all hover:border-primary/40 hover:shadow-sm",
          className
        )}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
              <CardDescription className="text-xs">
                {card.source || "Chrome fleet"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-2xl font-semibold text-foreground tabular-nums">
            {card.value}
          </div>
          {card.note && (
            <p className="text-xs text-muted-foreground">{card.note}</p>
          )}
          {formattedDate && (
            <p className="text-xs text-muted-foreground/70">
              Last updated: {formattedDate}
            </p>
          )}
          {card.action && onAction && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full justify-between"
              onClick={() => onAction(card.action)}
            >
              <span>{card.action}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
});

export interface PostureCardListProps {
  cards: PostureCardData[];
  className?: string;
  onAction?: (action: string) => void;
}

export const PostureCardList = memo(function PostureCardList({
  cards,
  className,
  onAction,
}: PostureCardListProps) {
  if (cards.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          No posture data available yet.
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Try running &quot;Show recent Chrome events&quot; to get started.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("grid gap-3", className)}>
      {cards.map((card, i) => (
        <PostureCard
          key={card.label}
          card={card}
          index={i}
          onAction={onAction}
        />
      ))}
    </div>
  );
});
