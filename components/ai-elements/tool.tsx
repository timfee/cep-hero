/**
 * Tool invocation display component for AI chat interfaces.
 * Shows tool calls with their status, input parameters, and output results in a collapsible format.
 */
"use client";

import type { DynamicToolUIPart, ToolUIPart } from "ai";
import type { ComponentProps, ReactNode } from "react";

import { motion } from "framer-motion";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  CircleIcon,
  XCircleIcon,
} from "lucide-react";
import { isValidElement } from "react";

import type { OrgUnitInfo } from "@/components/ui/org-unit-context";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useOrgUnitMap } from "@/components/ui/org-unit-context";
import { normalizeResource } from "@/lib/mcp/org-units";
import { cn } from "@/lib/utils";

import { CodeBlock } from "./code-block";

/**
 * Replaces org unit ID patterns in a JSON string with human-readable paths.
 * Handles "orgunits/abc123" and "id:abc123" patterns found in tool output.
 */
function sanitizeOrgUnitIdsInJson(
  json: string,
  orgUnitMap: Map<string, OrgUnitInfo>
): string {
  if (orgUnitMap.size === 0) {
    return json;
  }

  return json.replace(/(?:orgunits|id:)\/?\b[a-z0-9_-]+\b/gi, (match) => {
    const normalized = normalizeResource(match);
    const info = orgUnitMap.get(normalized);
    if (info) {
      return info.path;
    }

    // Also try with orgunits/ prefix for bare IDs after id: stripping
    if (!normalized.startsWith("orgunits/")) {
      const withPrefix = `orgunits/${normalized}`;
      const prefixInfo = orgUnitMap.get(withPrefix);
      if (prefixInfo) {
        return prefixInfo.path;
      }
    }

    return match;
  });
}

export type ToolProps = ComponentProps<typeof Collapsible>;

/**
 * Root container for displaying a tool invocation with collapsible content.
 */
export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible
    className={cn("group not-prose mb-4 w-full rounded-md border", className)}
    {...props}
  />
);

/**
 * Union type representing either a static or dynamic tool UI part.
 */
export type ToolPart = ToolUIPart | DynamicToolUIPart;

export type ToolHeaderProps = {
  title?: string;
  className?: string;
} & (
  | { type: ToolUIPart["type"]; state: ToolUIPart["state"]; toolName?: never }
  | {
      type: DynamicToolUIPart["type"];
      state: DynamicToolUIPart["state"];
      toolName: string;
    }
);

/**
 * Returns an animated status badge with icon based on the tool execution state.
 */
export const getStatusBadge = (status: ToolPart["state"]) => {
  const labels: Record<ToolPart["state"], string> = {
    "input-streaming": "Pending",
    "input-available": "Running",
    "approval-requested": "Awaiting Approval",
    "approval-responded": "Responded",
    "output-available": "Completed",
    "output-error": "Error",
    "output-denied": "Denied",
  };

  const isActive = status === "input-streaming" || status === "input-available";

  const icons: Record<ToolPart["state"], ReactNode> = {
    "input-streaming": (
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <CircleIcon className="size-3.5" />
      </motion.div>
    ),
    "input-available": (
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <CircleIcon className="size-3.5" />
      </motion.div>
    ),
    "approval-requested": <CircleIcon className="size-3.5 text-yellow-600" />,
    "approval-responded": (
      <CheckCircleIcon className="size-3.5 text-blue-600" />
    ),
    "output-available": (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 10 }}
      >
        <CheckCircleIcon className="size-3.5 text-green-600" />
      </motion.div>
    ),
    "output-error": (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 10 }}
      >
        <XCircleIcon className="size-3.5 text-red-600" />
      </motion.div>
    ),
    "output-denied": <XCircleIcon className="size-3.5 text-orange-600" />,
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Badge
        className={cn(
          "gap-1.5 rounded-full text-xs transition-colors",
          isActive && "bg-primary/10 text-primary"
        )}
        variant="secondary"
      >
        {icons[status]}
        {labels[status]}
      </Badge>
    </motion.div>
  );
};

/**
 * Clickable header that displays tool name, status badge, and toggle chevron.
 */
export const ToolHeader = ({
  className,
  title,
  type,
  state,
  toolName,
  ...props
}: ToolHeaderProps) => {
  const derivedName =
    type === "dynamic-tool" ? toolName : type.split("-").slice(1).join("-");
  return (
    <CollapsibleTrigger
      className={cn(
        "flex w-full items-center justify-between gap-4 p-3 transition-colors hover:bg-muted/50",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{title ?? derivedName}</span>
        {getStatusBadge(state)}
      </div>
      <motion.div
        initial={false}
        animate={{ rotate: 0 }}
        className="group-data-[state=open]:rotate-180 transition-transform"
      >
        <ChevronDownIcon className="size-4 text-muted-foreground" />
      </motion.div>
    </CollapsibleTrigger>
  );
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

/**
 * Animated collapsible content area for tool details.
 */
export const ToolContent = ({
  className,
  children,
  ...props
}: ToolContentProps) => (
  <CollapsibleContent className={cn("overflow-hidden", className)} {...props}>
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  </CollapsibleContent>
);

export type ToolInputProps = ComponentProps<"div"> & {
  input: ToolPart["input"];
};

/**
 * Displays tool input parameters as formatted JSON in a code block.
 * Org unit IDs are replaced with human-readable paths when the context is available.
 */
export const ToolInput = ({ className, input, ...props }: ToolInputProps) => {
  const orgUnitMap = useOrgUnitMap();
  const json = sanitizeOrgUnitIdsInJson(
    JSON.stringify(input, null, 2),
    orgUnitMap
  );
  return (
    <div className={cn("space-y-2 overflow-hidden p-4", className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        Parameters
      </h4>
      <div className="rounded-md bg-muted/50">
        <CodeBlock code={json} language="json" />
      </div>
    </div>
  );
};

export type ToolOutputProps = ComponentProps<"div"> & {
  output: ToolPart["output"];
  errorText: ToolPart["errorText"];
};

/**
 * Displays tool execution results or error messages with appropriate styling.
 * Org unit IDs in JSON output are replaced with human-readable paths.
 */
export const ToolOutput = ({
  className,
  output,
  errorText,
  ...props
}: ToolOutputProps) => {
  const orgUnitMap = useOrgUnitMap();

  if (!(output || errorText)) {
    return null;
  }

  let Output = <div>{output as ReactNode}</div>;

  if (typeof output === "object" && !isValidElement(output)) {
    const json = sanitizeOrgUnitIdsInJson(
      JSON.stringify(output, null, 2),
      orgUnitMap
    );
    Output = <CodeBlock code={json} language="json" />;
  } else if (typeof output === "string") {
    const sanitized = sanitizeOrgUnitIdsInJson(output, orgUnitMap);
    Output = <CodeBlock code={sanitized} language="json" />;
  }

  return (
    <div className={cn("space-y-2 p-4", className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {errorText ? "Error" : "Result"}
      </h4>
      <div
        className={cn(
          "overflow-x-auto rounded-md text-xs [&_table]:w-full",
          errorText
            ? "bg-destructive/10 text-destructive"
            : "bg-muted/50 text-foreground"
        )}
      >
        {errorText && <div>{errorText}</div>}
        {Output}
      </div>
    </div>
  );
};
