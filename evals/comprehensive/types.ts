/**
 * Types for the comprehensive eval orchestration system.
 */

import { type EvalReport, type EvalSummary } from "../lib/reporter";

export type RunMode =
  | "fixture-with-judge"
  | "fixture-without-judge"
  | "live-with-judge"
  | "live-without-judge";

export interface RunConfiguration {
  mode: RunMode;
  name: string;
  description: string;
  env: Record<string, string>;
}

export interface SingleRunResult {
  mode: RunMode;
  runId: string;
  summary: EvalSummary;
  reports: EvalReport[];
  startTime: string;
  endTime: string;
  durationMs: number;
}

export interface AggregatedResults {
  runId: string;
  timestamp: string;
  totalRuns: number;
  configurations: RunMode[];
  runs: SingleRunResult[];
  aggregateStats: AggregateStats;
  caseAnalysis: CaseAnalysis[];
  categoryAnalysis: CategoryAnalysis[];
}

export interface AggregateStats {
  totalCases: number;
  totalExecutions: number;
  overallPassRate: number;
  byMode: Record<
    RunMode,
    {
      passRate: number;
      avgDurationMs: number;
      passed: number;
      failed: number;
      errors: number;
    }
  >;
}

export interface CaseAnalysis {
  caseId: string;
  title: string;
  category: string;
  results: {
    mode: RunMode;
    status: "pass" | "fail" | "error";
    durationMs: number;
    error?: string;
  }[];
  consistency: "stable-pass" | "stable-fail" | "flaky";
  passRate: number;
}

export interface CategoryAnalysis {
  category: string;
  totalCases: number;
  passRateByMode: Record<RunMode, number>;
  avgPassRate: number;
  problematicCases: string[];
}

export interface GeminiAnalysis {
  executiveSummary: string;
  keyFindings: string[];
  categoryInsights: CategoryInsight[];
  recommendations: Recommendation[];
  riskAssessment: RiskAssessment;
  actionItems: ActionItem[];
}

export interface CategoryInsight {
  category: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

export interface Recommendation {
  priority: "critical" | "high" | "medium" | "low";
  area: string;
  recommendation: string;
  rationale: string;
  effort: "low" | "medium" | "high";
}

export interface RiskAssessment {
  overallRisk: "low" | "medium" | "high" | "critical";
  riskFactors: {
    factor: string;
    severity: "low" | "medium" | "high";
    description: string;
  }[];
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  priority: number;
  category: string;
  relatedCases: string[];
}

export interface ComprehensiveReport {
  runId: string;
  timestamp: string;
  aggregatedResults: AggregatedResults;
  geminiAnalysis: GeminiAnalysis;
  htmlReportPath?: string;
  jsonReportPath?: string;
}

export interface CliOptions {
  modes?: RunMode[];
  iterations?: number;
  skipLive?: boolean;
  skipAnalysis?: boolean;
  outputDir?: string;
  verbose?: boolean;
  caseIds?: string;
  categories?: string;
}

export interface ResolvedCliOptions {
  modes: RunMode[];
  iterations: number;
  skipLive: boolean;
  skipAnalysis: boolean;
  outputDir: string;
  verbose: boolean;
  caseIds?: string;
  categories?: string;
}
