/**
 * Test results display component for showing test suite outcomes.
 * Renders test passes, failures, and skips with visual indicators and expandable details.
 */
"use client";

import type { ComponentProps, HTMLAttributes } from "react";

import {
  CheckCircle2Icon,
  ChevronRightIcon,
  CircleDotIcon,
  CircleIcon,
  XCircleIcon,
} from "lucide-react";
import { createContext, useContext } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type TestStatus = "passed" | "failed" | "skipped" | "running";

interface TestResultsSummary {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration?: number;
}

interface TestResultsContextType {
  summary?: TestResultsSummary;
}

const TestResultsContext = createContext<TestResultsContextType>({});

export type TestResultsProps = HTMLAttributes<HTMLDivElement> & {
  summary?: TestResultsSummary;
};

/**
 * Root container that provides test summary context and renders results.
 */
export const TestResults = ({
  summary,
  className,
  children,
  ...props
}: TestResultsProps) => (
  <TestResultsContext.Provider value={{ summary }}>
    <div
      className={cn("rounded-lg border bg-background", className)}
      {...props}
    >
      {children ??
        (summary && (
          <TestResultsHeader>
            <TestResultsSummary />
            <TestResultsDuration />
          </TestResultsHeader>
        ))}
    </div>
  </TestResultsContext.Provider>
);

export type TestResultsHeaderProps = HTMLAttributes<HTMLDivElement>;

/**
 * Header section with flex layout for summary and duration.
 */
export const TestResultsHeader = ({
  className,
  children,
  ...props
}: TestResultsHeaderProps) => (
  <div
    className={cn(
      "flex items-center justify-between border-b px-4 py-3",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export type TestResultsSummaryProps = HTMLAttributes<HTMLDivElement>;

/**
 * Summary badges showing passed, failed, and skipped test counts.
 */
export const TestResultsSummary = ({
  className,
  children,
  ...props
}: TestResultsSummaryProps) => {
  const { summary } = useContext(TestResultsContext);

  if (!summary) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-3", className)} {...props}>
      {children ?? (
        <>
          <Badge
            className="gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            variant="secondary"
          >
            <CheckCircle2Icon className="size-3" />
            {summary.passed} passed
          </Badge>
          {summary.failed > 0 && (
            <Badge
              className="gap-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              variant="secondary"
            >
              <XCircleIcon className="size-3" />
              {summary.failed} failed
            </Badge>
          )}
          {summary.skipped > 0 && (
            <Badge
              className="gap-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
              variant="secondary"
            >
              <CircleIcon className="size-3" />
              {summary.skipped} skipped
            </Badge>
          )}
        </>
      )}
    </div>
  );
};

export type TestResultsDurationProps = HTMLAttributes<HTMLSpanElement>;

/**
 * Displays total test run duration formatted as milliseconds or seconds.
 */
export const TestResultsDuration = ({
  className,
  children,
  ...props
}: TestResultsDurationProps) => {
  const { summary } = useContext(TestResultsContext);

  if (!summary?.duration) {
    return null;
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <span className={cn("text-muted-foreground text-sm", className)} {...props}>
      {children ?? formatDuration(summary.duration)}
    </span>
  );
};

export type TestResultsProgressProps = HTMLAttributes<HTMLDivElement>;

/**
 * Progress bar visualization showing pass/fail ratio.
 */
export const TestResultsProgress = ({
  className,
  children,
  ...props
}: TestResultsProgressProps) => {
  const { summary } = useContext(TestResultsContext);

  if (!summary) {
    return null;
  }

  const passedPercent = (summary.passed / summary.total) * 100;
  const failedPercent = (summary.failed / summary.total) * 100;

  return (
    <div className={cn("space-y-2", className)} {...props}>
      {children ?? (
        <>
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="bg-green-500 transition-all"
              style={{ width: `${passedPercent}%` }}
            />
            <div
              className="bg-red-500 transition-all"
              style={{ width: `${failedPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-muted-foreground text-xs">
            <span>
              {summary.passed}/{summary.total} tests passed
            </span>
            <span>{passedPercent.toFixed(0)}%</span>
          </div>
        </>
      )}
    </div>
  );
};

export type TestResultsContentProps = HTMLAttributes<HTMLDivElement>;

/**
 * Content area for displaying test suites and individual tests.
 */
export const TestResultsContent = ({
  className,
  children,
  ...props
}: TestResultsContentProps) => (
  <div className={cn("space-y-2 p-4", className)} {...props}>
    {children}
  </div>
);

interface TestSuiteContextType {
  name: string;
  status: TestStatus;
}

const TestSuiteContext = createContext<TestSuiteContextType>({
  name: "",
  status: "passed",
});

export type TestSuiteProps = ComponentProps<typeof Collapsible> & {
  name: string;
  status: TestStatus;
};

/**
 * Collapsible test suite container that provides name and status context.
 */
export const TestSuite = ({
  name,
  status,
  className,
  children,
  ...props
}: TestSuiteProps) => (
  <TestSuiteContext.Provider value={{ name, status }}>
    <Collapsible className={cn("rounded-lg border", className)} {...props}>
      {children}
    </Collapsible>
  </TestSuiteContext.Provider>
);

export type TestSuiteNameProps = ComponentProps<typeof CollapsibleTrigger>;

/**
 * Clickable suite name header with status icon and expand/collapse behavior.
 */
export const TestSuiteName = ({
  className,
  children,
  ...props
}: TestSuiteNameProps) => {
  const { name, status } = useContext(TestSuiteContext);

  return (
    <CollapsibleTrigger
      className={cn(
        "group flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/50",
        className
      )}
      {...props}
    >
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
      <TestStatusIcon status={status} />
      <span className="font-medium text-sm">{children ?? name}</span>
    </CollapsibleTrigger>
  );
};

export type TestSuiteStatsProps = HTMLAttributes<HTMLDivElement> & {
  passed?: number;
  failed?: number;
  skipped?: number;
};

/**
 * Inline statistics display for test suite pass/fail/skip counts.
 */
export const TestSuiteStats = ({
  passed = 0,
  failed = 0,
  skipped = 0,
  className,
  children,
  ...props
}: TestSuiteStatsProps) => (
  <div
    className={cn("ml-auto flex items-center gap-2 text-xs", className)}
    {...props}
  >
    {children ?? (
      <>
        {passed > 0 && (
          <span className="text-green-600 dark:text-green-400">
            {passed} passed
          </span>
        )}
        {failed > 0 && (
          <span className="text-red-600 dark:text-red-400">
            {failed} failed
          </span>
        )}
        {skipped > 0 && (
          <span className="text-yellow-600 dark:text-yellow-400">
            {skipped} skipped
          </span>
        )}
      </>
    )}
  </div>
);

export type TestSuiteContentProps = ComponentProps<typeof CollapsibleContent>;

/**
 * Expandable content area containing individual tests within a suite.
 */
export const TestSuiteContent = ({
  className,
  children,
  ...props
}: TestSuiteContentProps) => (
  <CollapsibleContent className={cn("border-t", className)} {...props}>
    <div className="divide-y">{children}</div>
  </CollapsibleContent>
);

interface TestContextType {
  name: string;
  status: TestStatus;
  duration?: number;
}

const TestContext = createContext<TestContextType>({
  name: "",
  status: "passed",
});

export type TestProps = HTMLAttributes<HTMLDivElement> & {
  name: string;
  status: TestStatus;
  duration?: number;
};

/**
 * Individual test result display with status icon, name, and optional duration.
 */
export const Test = ({
  name,
  status,
  duration,
  className,
  children,
  ...props
}: TestProps) => (
  <TestContext.Provider value={{ name, status, duration }}>
    <div
      className={cn("flex items-center gap-2 px-4 py-2 text-sm", className)}
      {...props}
    >
      {children ?? (
        <>
          <TestStatus />
          <TestName />
          {duration !== undefined && <TestDuration />}
        </>
      )}
    </div>
  </TestContext.Provider>
);

const statusStyles: Record<TestStatus, string> = {
  passed: "text-green-600 dark:text-green-400",
  failed: "text-red-600 dark:text-red-400",
  skipped: "text-yellow-600 dark:text-yellow-400",
  running: "text-blue-600 dark:text-blue-400",
};

const statusIcons: Record<TestStatus, React.ReactNode> = {
  passed: <CheckCircle2Icon className="size-4" />,
  failed: <XCircleIcon className="size-4" />,
  skipped: <CircleIcon className="size-4" />,
  running: <CircleDotIcon className="size-4 animate-pulse" />,
};

/**
 * Icon indicator for test status with appropriate color styling.
 */
const TestStatusIcon = ({ status }: { status: TestStatus }) => (
  <span className={cn("shrink-0", statusStyles[status])}>
    {statusIcons[status]}
  </span>
);

export type TestStatusProps = HTMLAttributes<HTMLSpanElement>;

/**
 * Test status indicator that displays the appropriate icon from context.
 */
export const TestStatus = ({
  className,
  children,
  ...props
}: TestStatusProps) => {
  const { status } = useContext(TestContext);

  return (
    <span
      className={cn("shrink-0", statusStyles[status], className)}
      {...props}
    >
      {children ?? statusIcons[status]}
    </span>
  );
};

export type TestNameProps = HTMLAttributes<HTMLSpanElement>;

/**
 * Test name display that reads from the test context.
 */
export const TestName = ({ className, children, ...props }: TestNameProps) => {
  const { name } = useContext(TestContext);

  return (
    <span className={cn("flex-1", className)} {...props}>
      {children ?? name}
    </span>
  );
};

export type TestDurationProps = HTMLAttributes<HTMLSpanElement>;

/**
 * Duration display for individual test execution time in milliseconds.
 */
export const TestDuration = ({
  className,
  children,
  ...props
}: TestDurationProps) => {
  const { duration } = useContext(TestContext);

  if (duration === undefined) {
    return null;
  }

  return (
    <span
      className={cn("ml-auto text-muted-foreground text-xs", className)}
      {...props}
    >
      {children ?? `${duration}ms`}
    </span>
  );
};

export type TestErrorProps = HTMLAttributes<HTMLDivElement>;

/**
 * Error container with red background for displaying test failure details.
 */
export const TestError = ({
  className,
  children,
  ...props
}: TestErrorProps) => (
  <div
    className={cn(
      "mt-2 rounded-md bg-red-50 p-3 dark:bg-red-900/20",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export type TestErrorMessageProps = HTMLAttributes<HTMLParagraphElement>;

/**
 * Error message text display with red styling.
 */
export const TestErrorMessage = ({
  className,
  children,
  ...props
}: TestErrorMessageProps) => (
  <p
    className={cn(
      "font-medium text-red-700 text-sm dark:text-red-400",
      className
    )}
    {...props}
  >
    {children}
  </p>
);

export type TestErrorStackProps = HTMLAttributes<HTMLPreElement>;

/**
 * Preformatted stack trace display for test error debugging.
 */
export const TestErrorStack = ({
  className,
  children,
  ...props
}: TestErrorStackProps) => (
  <pre
    className={cn(
      "mt-2 overflow-auto font-mono text-red-600 text-xs dark:text-red-400",
      className
    )}
    {...props}
  >
    {children}
  </pre>
);
