"use client";

import {
  Shield,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Settings2,
} from "lucide-react";
import { motion } from "motion/react";
import { useState, memo } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { OrgUnitDisplay } from "@/components/ui/org-unit-display";
import { cn } from "@/lib/utils";

export interface PolicyValue {
  policySchema?: string;
  value?: Record<string, unknown>;
  sourceKey?: {
    targetResource?: string;
  };
}

export interface ResolvedPolicy {
  targetKey?: {
    targetResource?: string;
  };
  value?: {
    policySchema?: string;
    value?: Record<string, unknown>;
  };
  sourceKey?: {
    targetResource?: string;
  };
}

export interface PolicyCardProps {
  policy: ResolvedPolicy;
  className?: string;
  index?: number;
}

function formatPolicyName(schema?: string): string {
  if (!schema) {
    return "Unknown Policy";
  }
  // Extract the policy name from schema like "chrome.users.SafeBrowsingProtectionLevel"
  const parts = schema.split(".");
  return parts.at(-1) || schema;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "Not set";
  }
  if (typeof value === "boolean") {
    return value ? "Enabled" : "Disabled";
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

export const PolicyCard = memo(function PolicyCard({
  policy,
  className,
  index = 0,
}: PolicyCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const schema = policy.value?.policySchema;
  const policyName = formatPolicyName(schema);
  const values = policy.value?.value ?? {};
  const targetResource =
    policy.sourceKey?.targetResource ?? policy.targetKey?.targetResource;

  const valueEntries = Object.entries(values);
  const hasValues = valueEntries.length > 0;

  // Determine if policy is "enabled" based on common patterns
  const isEnabled =
    values.safeBrowsingProtectionLevel !== undefined
      ? values.safeBrowsingProtectionLevel !== 0
      : values.enabled !== false && values.value !== false;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03 }}
        className={cn(
          "rounded-lg border border-border bg-card overflow-hidden",
          className
        )}
      >
        <CollapsibleTrigger className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
              isEnabled ? "bg-status-positive/10" : "bg-muted"
            )}
          >
            <Shield
              className={cn(
                "h-4 w-4",
                isEnabled ? "text-status-positive" : "text-muted-foreground"
              )}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">
              {policyName}
            </p>
            {targetResource && (
              <div className="truncate">
                <OrgUnitDisplay targetResource={targetResource} size="sm" />
              </div>
            )}
          </div>
          <Badge
            variant="secondary"
            className={cn(
              "text-xs",
              isEnabled
                ? "bg-status-positive/10 text-status-positive border-0"
                : "bg-muted text-muted-foreground"
            )}
          >
            {isEnabled ? (
              <>
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Active
              </>
            ) : (
              <>
                <XCircle className="mr-1 h-3 w-3" />
                Inactive
              </>
            )}
          </Badge>
          {hasValues && (
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          )}
        </CollapsibleTrigger>

        {hasValues && (
          <CollapsibleContent>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="border-t border-border bg-muted/30 p-3"
            >
              <div className="space-y-2">
                {valueEntries.map(([key, val], i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Settings2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {key}
                      </p>
                      <p className="text-sm text-foreground break-all">
                        {formatValue(val)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {schema && (
                <div className="mt-3 pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {schema}
                  </p>
                </div>
              )}
            </motion.div>
          </CollapsibleContent>
        )}
      </motion.div>
    </Collapsible>
  );
});

export interface PolicyListProps {
  policies: ResolvedPolicy[];
  className?: string;
  title?: string;
}

export const PolicyList = memo(function PolicyList({
  policies,
  className,
  title = "Resolved Policies",
}: PolicyListProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (policies.length === 0) {
    return null;
  }

  const activeCount = policies.filter((p) => {
    const values = p.value?.value ?? {};
    return (
      values.safeBrowsingProtectionLevel !== 0 &&
      values.enabled !== false &&
      values.value !== false
    );
  }).length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          "rounded-lg border border-border bg-card overflow-hidden",
          className
        )}
      >
        <CollapsibleTrigger className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50">
          <Shield className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1 text-sm font-medium text-foreground">
            {title}
          </span>
          <Badge variant="secondary" className="text-xs">
            {activeCount}/{policies.length} active
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="border-t border-border p-3 space-y-2"
          >
            {policies.map((policy, i) => (
              <PolicyCard key={i} policy={policy} index={i} />
            ))}
          </motion.div>
        </CollapsibleContent>
      </motion.div>
    </Collapsible>
  );
});
