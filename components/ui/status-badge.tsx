import type { VariantProps } from "class-variance-authority";

import { cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
  {
    variants: {
      status: {
        positive:
          "bg-status-positive/15 text-status-positive ring-1 ring-status-positive/30",
        warning:
          "bg-status-warning/15 text-status-warning ring-1 ring-status-warning/30",
        info: "bg-status-info/15 text-status-info ring-1 ring-status-info/30",
        neutral: "bg-muted text-muted-foreground ring-1 ring-border",
      },
    },
    defaultVariants: {
      status: "info",
    },
  }
);

interface StatusBadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  /**
   * Icon component to display before the label
   */
  icon?: React.ComponentType<{ className?: string }>;
  /**
   * Primary label text
   */
  label: string;
  /**
   * Optional value to display after the label
   */
  value?: string;
}

function StatusBadge({
  className,
  status,
  icon: Icon,
  label,
  value,
  ...props
}: StatusBadgeProps) {
  return (
    <div
      data-slot="status-badge"
      className={cn(statusBadgeVariants({ status }), className)}
      {...props}
    >
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      <span className="uppercase tracking-widest">{label}</span>
      {value && <span className="font-semibold">{value}</span>}
    </div>
  );
}

export { StatusBadge, statusBadgeVariants };
