"use client";

import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Shield,
  Building2,
  ArrowRight,
  FileWarning,
} from "lucide-react";
import { motion } from "motion/react";
import { useState, memo } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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

function formatPolicyValue(value: unknown): string {
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

function extractPolicyName(schemaId: string): string {
  const parts = schemaId.split(".");
  const name = parts.at(-1) ?? schemaId;
  return name.replaceAll(/([A-Z])/g, " $1").trim();
}

export const PolicyChangeConfirmation = memo(function PolicyChangeConfirmation({
  proposal,
  onConfirm,
  onCancel,
  isApplying = false,
  className,
}: PolicyChangeConfirmationProps) {
  const [hasAcknowledged, setHasAcknowledged] = useState(false);

  const policySchemaId =
    proposal.applyParams?.policySchemaId ?? "Unknown Policy";
  const targetResource =
    proposal.applyParams?.targetResource ?? proposal.target;
  const proposedValue = proposal.applyParams?.value ?? proposal.diff;

  const policyName = extractPolicyName(policySchemaId);
  const valueEntries =
    typeof proposedValue === "object" && proposedValue !== null
      ? Object.entries(proposedValue as Record<string, unknown>)
      : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("w-full", className)}
    >
      <Card className="border-2 border-amber-500/50 bg-amber-50/10 dark:bg-amber-950/10">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 space-y-1">
              <AlertTitle className="text-lg font-semibold text-foreground">
                Policy Change Requires Approval
              </AlertTitle>
              <AlertDescription className="text-sm text-muted-foreground">
                Review the proposed changes carefully before confirming.
              </AlertDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Policy Info */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Policy</span>
            </div>
            <div className="pl-6 space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {policyName}
              </p>
              <p className="text-xs font-mono text-muted-foreground break-all">
                {policySchemaId}
              </p>
            </div>
          </div>

          {/* Target Org Unit */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Target Organization</span>
            </div>
            <div className="pl-6">
              <p className="text-sm font-mono text-foreground break-all">
                {targetResource}
              </p>
            </div>
          </div>

          {/* Proposed Values - THE DIFF */}
          <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm text-primary">
                Proposed Configuration
              </span>
              <Badge variant="outline" className="ml-auto text-xs">
                NEW VALUES
              </Badge>
            </div>
            <div className="pl-6 space-y-2">
              {valueEntries.length > 0 ? (
                valueEntries.map(([key, val]) => (
                  <div
                    key={key}
                    className="flex items-start gap-2 rounded bg-background/50 p-2"
                  >
                    <code className="text-xs font-medium text-muted-foreground min-w-[120px]">
                      {key}:
                    </code>
                    <code className="text-xs text-foreground font-semibold break-all">
                      {formatPolicyValue(val)}
                    </code>
                  </div>
                ))
              ) : (
                <pre className="text-xs bg-background/50 p-2 rounded overflow-x-auto">
                  {JSON.stringify(proposedValue, null, 2)}
                </pre>
              )}
            </div>
          </div>

          {/* Reasoning */}
          {proposal.description && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Reason: </span>
                {proposal.description}
              </p>
            </div>
          )}

          <Separator />

          {/* Warning Alert */}
          <Alert
            variant="destructive"
            className="border-red-500/50 bg-red-50/50 dark:bg-red-950/20"
          >
            <FileWarning className="h-4 w-4" />
            <AlertTitle className="text-sm font-semibold">
              This action will modify your Google Workspace configuration
            </AlertTitle>
            <AlertDescription className="text-xs mt-1">
              Changes will take effect immediately and apply to all users in the
              target organization unit. Ensure you have reviewed the proposed
              values above.
            </AlertDescription>
          </Alert>

          {/* Acknowledgment Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer rounded-lg border p-3 hover:bg-muted/50 transition-colors">
            <input
              type="checkbox"
              checked={hasAcknowledged}
              onChange={(e) => setHasAcknowledged(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm text-foreground">
              I have reviewed the proposed changes and understand that this will
              modify the Chrome Enterprise configuration for my organization.
            </span>
          </label>
        </CardContent>

        <CardFooter className="flex justify-between gap-3 pt-4">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isApplying}
            className="flex-1"
          >
            <XCircle className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={onConfirm}
            disabled={!hasAcknowledged || isApplying}
            className={cn(
              "flex-1",
              hasAcknowledged
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-muted text-muted-foreground"
            )}
          >
            {isApplying ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="mr-2"
                >
                  <Shield className="h-4 w-4" />
                </motion.div>
                Applying...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Confirm & Apply
              </>
            )}
          </Button>
        </CardFooter>

        {/* Admin Console Link */}
        {proposal.adminConsoleUrl && (
          <div className="px-6 pb-4">
            <p className="text-xs text-muted-foreground text-center">
              Or configure manually in the{" "}
              <a
                href={proposal.adminConsoleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:text-primary/80"
              >
                Google Admin Console
              </a>
            </p>
          </div>
        )}
      </Card>
    </motion.div>
  );
});

export default PolicyChangeConfirmation;
