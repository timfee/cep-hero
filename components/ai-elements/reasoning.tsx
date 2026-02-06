/**
 * Reasoning component for displaying AI chain-of-thought reasoning in a collapsible panel.
 * Auto-collapses after streaming completes and tracks reasoning duration.
 */
"use client";

import type { ComponentProps, ReactNode } from "react";

import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { BrainIcon, ChevronDownIcon } from "lucide-react";
import { createContext, memo, useContext, useEffect, useState } from "react";
import { Streamdown } from "streamdown";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface ReasoningContextValue {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration: number | undefined;
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

/**
 * Hook to access reasoning state including streaming status and duration.
 */
export const useReasoning = () => {
  const context = useContext(ReasoningContext);
  if (!context) {
    throw new Error("Reasoning components must be used within Reasoning");
  }
  return context;
};

export type ReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  duration?: number;
};

const AUTO_CLOSE_DELAY = 5000;
const MS_IN_S = 1000;

/**
 * Root reasoning container that tracks duration and auto-collapses after streaming.
 */
export const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    open,
    defaultOpen = true,
    onOpenChange,
    duration: durationProp,
    children,
    ...props
  }: ReasoningProps) => {
    const [isOpen, setIsOpen] = useControllableState({
      prop: open,
      defaultProp: defaultOpen,
      onChange: onOpenChange,
    });
    const [duration, setDuration] = useControllableState({
      prop: durationProp,
      defaultProp: undefined,
    });

    const [hasAutoClosed, setHasAutoClosed] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);

    // Track duration when streaming starts and ends
    useEffect(() => {
      if (isStreaming) {
        if (startTime === null) {
          setStartTime(Date.now());
        }
      } else if (startTime !== null) {
        setDuration(Math.ceil((Date.now() - startTime) / MS_IN_S));
        setStartTime(null);
      }
    }, [isStreaming, startTime, setDuration]);

    // Auto-open when streaming starts, auto-close when streaming ends (once only)
    useEffect(() => {
      if (defaultOpen && !isStreaming && isOpen && !hasAutoClosed) {
        // Add a small delay before closing to allow user to see the content
        const timer = setTimeout(() => {
          setIsOpen(false);
          setHasAutoClosed(true);
        }, AUTO_CLOSE_DELAY);

        return () => clearTimeout(timer);
      }
    }, [isStreaming, isOpen, defaultOpen, setIsOpen, hasAutoClosed]);

    const handleOpenChange = (newOpen: boolean) => {
      setIsOpen(newOpen);
    };

    return (
      <ReasoningContext.Provider
        value={{ isStreaming, isOpen, setIsOpen, duration }}
      >
        <Collapsible
          className={cn("not-prose mb-4", className)}
          onOpenChange={handleOpenChange}
          open={isOpen}
          {...props}
        >
          {children}
        </Collapsible>
      </ReasoningContext.Provider>
    );
  }
);

export type ReasoningTriggerProps = ComponentProps<
  typeof CollapsibleTrigger
> & {
  getThinkingMessage?: (isStreaming: boolean, duration?: number) => ReactNode;
};

/**
 * Animated indicator shown while AI is actively reasoning.
 */
const ThinkingAnimation = () => (
  <span className="flex items-center gap-2 text-primary">
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
    </span>
    Analyzing...
  </span>
);

/**
 * Returns the appropriate thinking message based on streaming state and duration.
 */
const defaultGetThinkingMessage = (isStreaming: boolean, duration?: number) => {
  if (isStreaming || duration === 0) {
    return <ThinkingAnimation />;
  }
  if (duration === undefined) {
    return <span>Reasoning</span>;
  }
  return <span>Reasoned for {duration}s</span>;
};

/**
 * Clickable trigger that displays thinking status and toggles content visibility.
 */
export const ReasoningTrigger = memo(
  ({
    className,
    children,
    getThinkingMessage = defaultGetThinkingMessage,
    ...props
  }: ReasoningTriggerProps) => {
    const { isStreaming, isOpen, duration } = useReasoning();

    return (
      <CollapsibleTrigger
        className={cn(
          "flex w-full cursor-pointer items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground transition-all hover:border-primary/40 hover:bg-primary/10",
          className
        )}
        {...props}
      >
        {children ?? (
          <>
            <BrainIcon className="size-3.5" />
            <span className="text-xs">
              {getThinkingMessage(isStreaming, duration)}
            </span>
            <ChevronDownIcon
              className={cn(
                "size-3.5 transition-transform",
                isOpen && "rotate-180"
              )}
            />
          </>
        )}
      </CollapsibleTrigger>
    );
  }
);

export type ReasoningContentProps = ComponentProps<
  typeof CollapsibleContent
> & {
  children: string;
};

/**
 * Collapsible content that renders markdown reasoning with streamdown plugins.
 */
export const ReasoningContent = memo(
  ({ className, children, ...props }: ReasoningContentProps) => {
    useReasoning();

    return (
      <CollapsibleContent>
        <div
          className={cn(
            "mt-3 rounded-lg border border-primary/10 bg-primary/5 p-4 text-sm text-foreground/80 leading-relaxed",
            className
          )}
          {...props}
        >
          <Streamdown plugins={{ code, mermaid, math, cjk }}>
            {children}
          </Streamdown>
        </div>
      </CollapsibleContent>
    );
  }
);

Reasoning.displayName = "Reasoning";
ReasoningTrigger.displayName = "ReasoningTrigger";
ReasoningContent.displayName = "ReasoningContent";
