import * as React from "react";
import { cn } from "@/lib/utils";

interface DashboardPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Optional title for the panel header
   */
  title?: string;
  /**
   * Optional description for the panel header
   */
  description?: string;
  /**
   * Whether to show the header section
   */
  showHeader?: boolean;
}

function DashboardPanel({
  className,
  title,
  description,
  showHeader = true,
  children,
  ...props
}: DashboardPanelProps) {
  const hasHeader = showHeader && (title || description);

  return (
    <div
      data-slot="dashboard-panel"
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        className
      )}
      {...props}
    >
      {hasHeader && (
        <div className="border-b border-border px-4 py-3">
          {title && (
            <h3 className="text-sm font-medium text-foreground">{title}</h3>
          )}
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

interface DashboardPanelHeaderProps
  extends React.HTMLAttributes<HTMLDivElement> {}

function DashboardPanelHeader({
  className,
  ...props
}: DashboardPanelHeaderProps) {
  return (
    <div
      data-slot="dashboard-panel-header"
      className={cn("border-b border-border px-4 py-3", className)}
      {...props}
    />
  );
}

interface DashboardPanelTitleProps
  extends React.HTMLAttributes<HTMLHeadingElement> {}

function DashboardPanelTitle({
  className,
  ...props
}: DashboardPanelTitleProps) {
  return (
    <h3
      data-slot="dashboard-panel-title"
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    />
  );
}

interface DashboardPanelDescriptionProps
  extends React.HTMLAttributes<HTMLParagraphElement> {}

function DashboardPanelDescription({
  className,
  ...props
}: DashboardPanelDescriptionProps) {
  return (
    <p
      data-slot="dashboard-panel-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

interface DashboardPanelContentProps
  extends React.HTMLAttributes<HTMLDivElement> {}

function DashboardPanelContent({
  className,
  ...props
}: DashboardPanelContentProps) {
  return (
    <div
      data-slot="dashboard-panel-content"
      className={cn("flex-1 p-4", className)}
      {...props}
    />
  );
}

interface DashboardPanelActionsProps
  extends React.HTMLAttributes<HTMLDivElement> {}

function DashboardPanelActions({
  className,
  ...props
}: DashboardPanelActionsProps) {
  return (
    <div
      data-slot="dashboard-panel-actions"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

export {
  DashboardPanel,
  DashboardPanelHeader,
  DashboardPanelTitle,
  DashboardPanelDescription,
  DashboardPanelContent,
  DashboardPanelActions,
};
