"use client";

import {
  Upload,
  Download,
  Printer,
  ClipboardCopy,
  ExternalLink,
} from "lucide-react";
import { motion } from "motion/react";
import { useState, memo } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { OrgUnitDisplay } from "@/components/ui/org-unit-display";
import { cn } from "@/lib/utils";

export interface PolicyChangeProposal {
  _type: "ui.confirmation";
  proposalId?: string;
  title: string;
  description: string;
  diff: unknown;
  target: string;
  adminConsoleUrl: string;
  intent: string;
  status: string;
  applyParams?: {
    policySchemaId: string;
    targetResource: string;
    value: unknown;
  };
}

export interface PolicyChangeConfirmationProps {
  proposal: PolicyChangeProposal;
  onConfirm?: () => void;
  onCancel?: () => void;
  isApplying?: boolean;
  className?: string;
}

const triggerConfig = {
  UPLOAD: { icon: Upload, label: "Upload" },
  DOWNLOAD: { icon: Download, label: "Download" },
  PRINT: { icon: Printer, label: "Print" },
  CLIPBOARD: { icon: ClipboardCopy, label: "Clipboard" },
} as const;

type TriggerKey = keyof typeof triggerConfig;

function extractPolicyName(schemaId: string): string {
  const parts = schemaId.split(".");
  const name = parts.at(-1) ?? schemaId;
  return name.replaceAll(/([A-Z])/g, " $1").trim();
}

function isDLPRule(value: unknown): value is {
  displayName?: string;
  triggers?: string[];
  action?: string;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    ("triggers" in value || "action" in value)
  );
}

function formatPolicyValue(value: unknown): string {
  if (value === null || value === undefined) return "Not set";
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  return String(value);
}

export const PolicyChangeConfirmation = memo(function PolicyChangeConfirmation({
  proposal,
  onConfirm,
  onCancel,
  isApplying = false,
  className,
}: PolicyChangeConfirmationProps) {
  const [confirmed, setConfirmed] = useState(false);

  const policySchemaId =
    proposal.applyParams?.policySchemaId ?? "Unknown Policy";
  const targetResource =
    proposal.applyParams?.targetResource ?? proposal.target;
  const targetDisplay = proposal.target || targetResource;
  const proposedValue = proposal.applyParams?.value ?? proposal.diff;

  const policyName = extractPolicyName(policySchemaId);
  const dlpData = isDLPRule(proposedValue) ? proposedValue : null;

  const triggers = (dlpData?.triggers ?? []).filter(
    (t): t is TriggerKey => t in triggerConfig
  );
  const action = dlpData?.action ?? null;
  const ruleName = dlpData?.displayName ?? policyName;

  const valueEntries =
    !dlpData && typeof proposedValue === "object" && proposedValue !== null
      ? Object.entries(proposedValue as Record<string, unknown>)
      : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "w-full max-w-sm rounded-lg border border-border bg-card overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            dlpData ? "bg-cyan-500" : "bg-amber-500"
          )}
        />
        <span className="text-sm font-medium text-foreground">
          {dlpData ? "New DLP Rule" : "Policy Change"}
        </span>
        <span className="ml-auto text-xs text-muted-foreground font-mono">
          pending
        </span>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {dlpData ? "Rule Name" : "Policy"}
          </span>
          <p className="text-xs text-foreground">{ruleName}</p>
        </div>

        {!dlpData && (
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Target Org Unit
            </span>
            <div>
              <OrgUnitDisplay
                name={
                  targetDisplay.startsWith("orgunits/")
                    ? undefined
                    : targetDisplay
                }
                targetResource={targetResource}
                size="sm"
              />
            </div>
          </div>
        )}

        {dlpData && (
          <div className="flex gap-8">
            {action && (
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Action
                </span>
                <p
                  className={cn(
                    "text-xs font-medium",
                    action === "BLOCK" && "text-red-400",
                    action === "WARN" && "text-orange-400",
                    action === "AUDIT" && "text-cyan-400"
                  )}
                >
                  {action}
                </p>
              </div>
            )}
            {triggers.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Triggers
                </span>
                <div className="flex gap-3">
                  {triggers.map((t) => {
                    const { icon: Icon, label } = triggerConfig[t];
                    return (
                      <div
                        key={t}
                        className="flex flex-col items-center gap-1 text-muted-foreground"
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="text-[10px]">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {!dlpData && valueEntries.length > 0 && (
          <div className="space-y-2">
            {valueEntries.map(([key, val]) => (
              <div key={key} className="flex items-baseline gap-2">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide min-w-[80px]">
                  {key}
                </span>
                <span className="text-xs text-foreground font-medium">
                  {formatPolicyValue(val)}
                </span>
              </div>
            ))}
          </div>
        )}

        {proposal.description && (
          <p className="text-xs text-muted-foreground">
            {proposal.description}
          </p>
        )}

        <label className="flex items-center gap-2 cursor-pointer pt-2">
          <Checkbox
            checked={confirmed}
            onCheckedChange={(c) => setConfirmed(c as boolean)}
            className="w-4 h-4 rounded border-muted-foreground/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
          <span className="text-xs text-muted-foreground">
            I understand this modifies Chrome Enterprise config
          </span>
        </label>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border flex items-center justify-between">
        <a
          href={proposal.adminConsoleUrl || "https://admin.google.com"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          Admin Console <ExternalLink className="w-3 h-3" />
        </a>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isApplying}
            className="h-8 px-3 text-sm"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!confirmed || isApplying}
            onClick={onConfirm}
            className="h-8 px-4 text-sm"
          >
            {isApplying ? "Applying..." : "Apply"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
});

export default PolicyChangeConfirmation;
