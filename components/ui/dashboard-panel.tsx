/**
 * Dashboard panel components for creating consistent admin panel layouts.
 */

import * as React from "react";

import { cn } from "@/lib/utils";

interface DashboardPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  showHeader?: boolean;
}

/**
 * Container panel for dashboard content with optional header section.
 */
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

interface DashboardPanelHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Header section for the dashboard panel.
 */
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

interface DashboardPanelTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

/**
 * Title text within the dashboard panel header.
 */
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

interface DashboardPanelDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

/**
 * Description text within the dashboard panel header.
 */
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

interface DashboardPanelContentProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Main content area of the dashboard panel.
 */
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

interface DashboardPanelActionsProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Container for action buttons within the dashboard panel.
 */
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
