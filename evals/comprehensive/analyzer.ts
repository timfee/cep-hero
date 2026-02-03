/**
 * Gemini 2.5 Pro analyzer for generating insights and recommendations from eval results.
 */

import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";

import { GEMINI_ANALYSIS_MODEL } from "./config";
import { type AggregatedResults, type GeminiAnalysis } from "./types";

const GeminiAnalysisSchema = z.object({
  executiveSummary: z
    .string()
    .describe(
      "2-3 paragraph executive summary of the eval results, highlighting key successes and areas of concern"
    ),
  keyFindings: z
    .array(z.string())
    .describe("Top 5-10 most important findings from the eval analysis"),
  categoryInsights: z.array(
    z.object({
      category: z.string().describe("The category name"),
      summary: z.string().describe("Brief summary of category performance"),
      strengths: z
        .array(z.string())
        .describe("Areas where this category performs well"),
      weaknesses: z
        .array(z.string())
        .describe("Areas where this category needs improvement"),
      suggestions: z
        .array(z.string())
        .describe("Specific suggestions for improvement"),
    })
  ),
  recommendations: z.array(
    z.object({
      priority: z
        .enum(["critical", "high", "medium", "low"])
        .describe("Priority level of the recommendation"),
      area: z.string().describe("Area of the system this affects"),
      recommendation: z.string().describe("The specific recommendation"),
      rationale: z.string().describe("Why this is recommended"),
      effort: z
        .enum(["low", "medium", "high"])
        .describe("Estimated effort to implement"),
    })
  ),
  riskAssessment: z.object({
    overallRisk: z
      .enum(["low", "medium", "high", "critical"])
      .describe("Overall risk level based on eval results"),
    riskFactors: z.array(
      z.object({
        factor: z.string().describe("The risk factor"),
        severity: z.enum(["low", "medium", "high"]).describe("Severity level"),
        description: z.string().describe("Description of the risk"),
      })
    ),
  }),
  actionItems: z.array(
    z.object({
      id: z.string().describe("Short identifier for the action item"),
      title: z.string().describe("Brief title of the action"),
      description: z.string().describe("Detailed description of what to do"),
      priority: z
        .number()
        .min(1)
        .max(10)
        .describe("Priority 1-10, 1 is highest"),
      category: z.string().describe("Category this action relates to"),
      relatedCases: z.array(z.string()).describe("Related case IDs"),
    })
  ),
});

/**
 * Build a detailed prompt for Gemini analysis.
 */
function buildAnalysisPrompt(results: AggregatedResults): string {
  const sections: string[] = [
    "# Comprehensive Eval Results Analysis Request",
    "",
    "You are an expert AI systems analyst reviewing evaluation results for CEP Hero,",
    "an AI assistant that helps IT administrators diagnose Chrome Enterprise issues.",
    "",
    "## Overview",
    `- Run ID: ${results.runId}`,
    `- Timestamp: ${results.timestamp}`,
    `- Total Runs: ${results.totalRuns}`,
    `- Configurations Tested: ${results.configurations.join(", ")}`,
    `- Total Cases: ${results.aggregateStats.totalCases}`,
    `- Overall Pass Rate: ${(results.aggregateStats.overallPassRate * 100).toFixed(1)}%`,
    "",
    "## Pass Rate by Mode",
  ];

  for (const [mode, stats] of Object.entries(results.aggregateStats.byMode)) {
    const total = stats.passed + stats.failed + stats.errors;
    sections.push(
      `- ${mode}: ${(stats.passRate * 100).toFixed(1)}% (${stats.passed}/${total}) avg ${stats.avgDurationMs}ms`
    );
  }

  sections.push("", "## Category Analysis");
  for (const cat of results.categoryAnalysis) {
    sections.push(
      `### ${cat.category} (${cat.totalCases} cases, ${(cat.avgPassRate * 100).toFixed(1)}% avg pass rate)`
    );
    const modeRates = Object.entries(cat.passRateByMode)
      .map(([m, r]) => `${m}: ${(r * 100).toFixed(0)}%`)
      .join(", ");
    sections.push(`Pass rates: ${modeRates}`);
    if (cat.problematicCases.length > 0) {
      sections.push(`Problematic cases: ${cat.problematicCases.join(", ")}`);
    }
    sections.push("");
  }

  sections.push("## Case Consistency Analysis");
  const stablePass = results.caseAnalysis.filter(
    (c) => c.consistency === "stable-pass"
  );
  const stableFail = results.caseAnalysis.filter(
    (c) => c.consistency === "stable-fail"
  );
  const flaky = results.caseAnalysis.filter((c) => c.consistency === "flaky");

  sections.push(`- Consistently Passing: ${stablePass.length} cases`);
  sections.push(`- Consistently Failing: ${stableFail.length} cases`);
  sections.push(`- Flaky: ${flaky.length} cases`);

  if (stableFail.length > 0) {
    sections.push("");
    sections.push("### Consistently Failing Cases");
    for (const c of stableFail.slice(0, 20)) {
      const errors = c.results
        .filter((r) => r.error)
        .map((r) => r.error)
        .slice(0, 2);
      sections.push(`- ${c.caseId} (${c.category}): ${c.title}`);
      if (errors.length > 0) {
        sections.push(`  Errors: ${errors.join("; ")}`);
      }
    }
  }

  if (flaky.length > 0) {
    sections.push("");
    sections.push("### Flaky Cases");
    for (const c of flaky.slice(0, 15)) {
      const passCount = c.results.filter((r) => r.status === "pass").length;
      sections.push(
        `- ${c.caseId} (${c.category}): ${c.title} - ${passCount}/${c.results.length} passed`
      );
    }
  }

  sections.push(
    "",
    "## Instructions",
    "Based on this data, provide:",
    "1. An executive summary of the overall eval health",
    "2. Key findings that stand out",
    "3. Insights for each category with strengths, weaknesses, and suggestions",
    "4. Prioritized recommendations for improvement",
    "5. Risk assessment based on failure patterns",
    "6. Specific action items with priorities",
    "",
    "Focus on actionable insights that would help improve the AI diagnostic system.",
    "Consider patterns across different modes (fixture vs live, with/without judge)."
  );

  return sections.join("\n");
}

/**
 * Analyze aggregated eval results using Gemini 2.5 Pro.
 */
export async function analyzeWithGemini(
  results: AggregatedResults
): Promise<GeminiAnalysis> {
  console.log("\n[comprehensive] Starting Gemini 2.5 Pro analysis...");
  console.log(`[comprehensive] Using model: ${GEMINI_ANALYSIS_MODEL}`);

  const prompt = buildAnalysisPrompt(results);

  try {
    const response = await generateText({
      model: google(GEMINI_ANALYSIS_MODEL),
      output: Output.object({ schema: GeminiAnalysisSchema }),
      prompt,
    });

    console.log("[comprehensive] Gemini analysis complete");
    if (!response.output) {
      throw new Error("No output generated");
    }
    return response.output;
  } catch (error) {
    console.error("[comprehensive] Gemini analysis failed:", error);

    return {
      executiveSummary: `Analysis failed due to an error: ${error instanceof Error ? error.message : String(error)}. Please review the raw data manually.`,
      keyFindings: [
        `Overall pass rate: ${(results.aggregateStats.overallPassRate * 100).toFixed(1)}%`,
        `Total cases tested: ${results.aggregateStats.totalCases}`,
        `Analysis could not be completed automatically`,
      ],
      categoryInsights: results.categoryAnalysis.map((cat) => ({
        category: cat.category,
        summary: `${cat.totalCases} cases with ${(cat.avgPassRate * 100).toFixed(1)}% average pass rate`,
        strengths: [],
        weaknesses:
          cat.problematicCases.length > 0
            ? [`${cat.problematicCases.length} problematic cases`]
            : [],
        suggestions: ["Review manually"],
      })),
      recommendations: [
        {
          priority: "high" as const,
          area: "Analysis",
          recommendation: "Retry Gemini analysis or review results manually",
          rationale: "Automated analysis failed",
          effort: "low" as const,
        },
      ],
      riskAssessment: {
        overallRisk: "medium" as const,
        riskFactors: [
          {
            factor: "Incomplete analysis",
            severity: "medium" as const,
            description: "Could not complete automated analysis",
          },
        ],
      },
      actionItems: [
        {
          id: "REVIEW-001",
          title: "Manual review required",
          description: "Review eval results manually due to analysis failure",
          priority: 1,
          category: "general",
          relatedCases: [],
        },
      ],
    };
  }
}

/**
 * Format Gemini analysis for console output.
 */
export function formatGeminiAnalysis(analysis: GeminiAnalysis): string {
  const lines: string[] = [
    "",
    "=".repeat(70),
    "GEMINI 2.5 PRO ANALYSIS",
    "=".repeat(70),
    "",
    "## Executive Summary",
    analysis.executiveSummary,
    "",
    "## Key Findings",
  ];

  for (const finding of analysis.keyFindings) {
    lines.push(`  • ${finding}`);
  }

  lines.push("", "## Top Recommendations");
  const topRecs = analysis.recommendations
    .toSorted((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })
    .slice(0, 5);

  for (const rec of topRecs) {
    lines.push(
      `  [${rec.priority.toUpperCase()}] ${rec.area}: ${rec.recommendation}`
    );
  }

  lines.push(
    "",
    `## Risk Assessment: ${analysis.riskAssessment.overallRisk.toUpperCase()}`,
    ""
  );
  for (const factor of analysis.riskAssessment.riskFactors) {
    lines.push(
      `  • ${factor.factor} (${factor.severity}): ${factor.description}`
    );
  }

  lines.push("", "## Priority Action Items");
  const topActions = analysis.actionItems
    .toSorted((a, b) => a.priority - b.priority)
    .slice(0, 5);
  for (const action of topActions) {
    lines.push(`  ${action.id}: ${action.title}`);
    lines.push(`    ${action.description}`);
  }

  lines.push("", "=".repeat(70));

  return lines.join("\n");
}
