#!/usr/bin/env bun
/**
 * Comprehensive eval CLI for running thorough evaluations across all configurations.
 *
 * Usage:
 *   bun evals/comprehensive/index.ts [options]
 *
 * Options:
 *   --modes <modes>      Comma-separated modes (fixture-with-judge,fixture-without-judge,live-with-judge,live-without-judge)
 *   --iterations <n>     Number of iterations per mode (default: 1)
 *   --skip-live          Skip live mode configurations
 *   --skip-analysis      Skip Gemini analysis
 *   --output <dir>       Output directory (default: evals/comprehensive/reports)
 *   --verbose            Enable verbose output
 *   --cases <ids>        Comma-separated case IDs to run
 *   --categories <cats>  Comma-separated categories to run
 *   --help               Show this help message
 *
 * Environment variables:
 *   GOOGLE_GENERATIVE_AI_API_KEY - Required for Gemini analysis
 *   COMPREHENSIVE_SKIP_LIVE      - Set to "1" to skip live modes
 *   COMPREHENSIVE_ITERATIONS     - Number of iterations per mode
 */

import { aggregateResults, formatAggregationSummary } from "./aggregator";
import { analyzeWithGemini, formatGeminiAnalysis } from "./analyzer";
import {
  DEFAULT_ITERATIONS,
  DEFAULT_OUTPUT_DIR,
  getDefaultModes,
} from "./config";
import { writeComprehensiveReport } from "./html-reporter";
import { orchestrateRuns } from "./orchestrator";
import {
  type CliOptions,
  type ComprehensiveReport,
  type RunMode,
} from "./types";

/**
 * Parse command line arguments.
 */
function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--modes" && args[i + 1]) {
      i += 1;
      options.modes = args[i].split(",") as RunMode[];
    }

    if (arg === "--iterations" && args[i + 1]) {
      i += 1;
      options.iterations = Number.parseInt(args[i], 10);
    }

    if (arg === "--skip-live") {
      options.skipLive = true;
    }

    if (arg === "--skip-analysis") {
      options.skipAnalysis = true;
    }

    if (arg === "--output" && args[i + 1]) {
      i += 1;
      options.outputDir = args[i];
    }

    if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
    }

    if (arg === "--cases" && args[i + 1]) {
      i += 1;
      options.caseIds = args[i];
    }

    if (arg === "--categories" && args[i + 1]) {
      i += 1;
      options.categories = args[i];
    }
  }

  return options;
}

/**
 * Print help message.
 */
function printHelp(): void {
  console.log(`
CEP Hero Comprehensive Eval System
===================================

Runs evaluations across multiple configurations, aggregates results,
and generates AI-powered insights using Gemini 2.5 Pro.

Usage:
  bun evals/comprehensive/index.ts [options]

Options:
  --modes <modes>      Comma-separated run modes:
                       - fixture-with-judge    (uses fixtures + LLM judge)
                       - fixture-without-judge (uses fixtures, string matching)
                       - live-with-judge       (uses live APIs + LLM judge)
                       - live-without-judge    (uses live APIs, string matching)
                       Default: fixture-with-judge,fixture-without-judge

  --iterations <n>     Number of iterations per mode (default: 1)
                       Higher values help identify flaky tests

  --skip-live          Skip live mode configurations (same as only fixture modes)

  --skip-analysis      Skip Gemini 2.5 Pro analysis phase

  --output <dir>       Output directory for reports
                       Default: evals/comprehensive/reports

  --verbose, -v        Enable verbose output during eval runs

  --cases <ids>        Comma-separated case IDs to run (e.g., "EC-001,EC-002")

  --categories <cats>  Comma-separated categories to run (e.g., "enrollment,network")

  --help, -h           Show this help message

Environment Variables:
  GOOGLE_GENERATIVE_AI_API_KEY    Required for Gemini analysis
  COMPREHENSIVE_SKIP_LIVE         Set to "1" to skip live modes
  COMPREHENSIVE_ITERATIONS        Number of iterations per mode

Examples:
  # Run default fixture modes
  bun evals/comprehensive/index.ts

  # Run all modes with 2 iterations each
  bun evals/comprehensive/index.ts --modes fixture-with-judge,fixture-without-judge,live-with-judge,live-without-judge --iterations 2

  # Run only fixture modes for specific categories
  bun evals/comprehensive/index.ts --skip-live --categories enrollment,network

  # Quick run with verbose output
  bun evals/comprehensive/index.ts --cases EC-001,EC-002 --verbose

  # Cron-friendly: run with all modes, skip interactive output
  COMPREHENSIVE_ITERATIONS=2 bun evals/comprehensive/index.ts --modes fixture-with-judge,live-with-judge
`);
}

/**
 * Resolve options from CLI args and environment variables.
 */
function resolveOptions(cliOptions: CliOptions): Required<CliOptions> {
  const skipLive =
    cliOptions.skipLive || process.env.COMPREHENSIVE_SKIP_LIVE === "1";

  let {modes} = cliOptions;
  if (!modes) {
    modes = skipLive ? getDefaultModes() : getDefaultModes();
  } else if (skipLive) {
    modes = modes.filter((m) => !m.startsWith("live"));
  }

  const iterations =
    cliOptions.iterations ??
    (process.env.COMPREHENSIVE_ITERATIONS
      ? Number.parseInt(process.env.COMPREHENSIVE_ITERATIONS, 10)
      : DEFAULT_ITERATIONS);

  return {
    modes,
    iterations,
    skipLive,
    skipAnalysis: cliOptions.skipAnalysis ?? false,
    outputDir: cliOptions.outputDir ?? DEFAULT_OUTPUT_DIR,
    verbose: cliOptions.verbose ?? false,
    caseIds: cliOptions.caseIds,
    categories: cliOptions.categories,
  };
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const cliOptions = parseArgs();
  const options = resolveOptions(cliOptions);

  console.log("\n");
  console.log(
    "╔════════════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║         CEP HERO COMPREHENSIVE EVAL SYSTEM                         ║"
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════════╝"
  );
  console.log("");
  console.log(`Modes:        ${options.modes.join(", ")}`);
  console.log(`Iterations:   ${options.iterations}`);
  console.log(`Output:       ${options.outputDir}`);
  console.log(
    `Analysis:     ${options.skipAnalysis ? "Disabled" : "Enabled (Gemini 2.5 Pro)"}`
  );
  if (options.caseIds) {
    console.log(`Cases:        ${options.caseIds}`);
  }
  if (options.categories) {
    console.log(`Categories:   ${options.categories}`);
  }
  console.log("");

  // Step 1: Orchestrate all runs
  const runs = await orchestrateRuns({
    modes: options.modes,
    iterations: options.iterations,
    caseIds: options.caseIds,
    categories: options.categories,
    verbose: options.verbose,
  });

  if (runs.length === 0) {
    console.log("[comprehensive] No runs completed");
    process.exit(1);
  }

  // Step 2: Aggregate results
  console.log("\n[comprehensive] Aggregating results...");
  const aggregated = aggregateResults(runs);
  console.log(formatAggregationSummary(aggregated));

  // Step 3: Gemini analysis (unless skipped)
  let geminiAnalysis;
  if (options.skipAnalysis) {
    console.log("[comprehensive] Skipping Gemini analysis (--skip-analysis)");
    geminiAnalysis = createDefaultAnalysis(aggregated);
  } else {
    geminiAnalysis = await analyzeWithGemini(aggregated);
    console.log(formatGeminiAnalysis(geminiAnalysis));
  }

  // Step 4: Build comprehensive report
  const report: ComprehensiveReport = {
    runId: aggregated.runId,
    timestamp: aggregated.timestamp,
    aggregatedResults: aggregated,
    geminiAnalysis,
  };

  // Step 5: Write reports
  const { htmlPath, jsonPath } = await writeComprehensiveReport(
    report,
    options.outputDir
  );

  report.htmlReportPath = htmlPath;
  report.jsonReportPath = jsonPath;

  // Final summary
  console.log("\n");
  console.log(
    "╔════════════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║         COMPREHENSIVE EVAL COMPLETE                                ║"
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════════╝"
  );
  console.log("");
  console.log(`Run ID:       ${report.runId}`);
  console.log(
    `Pass Rate:    ${(aggregated.aggregateStats.overallPassRate * 100).toFixed(1)}%`
  );
  console.log(`HTML Report:  ${htmlPath}`);
  console.log(`JSON Report:  ${jsonPath}`);
  console.log("");

  // Exit with appropriate code
  const hasFailures = aggregated.caseAnalysis.some(
    (c) => c.consistency === "stable-fail"
  );
  process.exit(hasFailures ? 1 : 0);
}

/**
 * Create a default analysis when Gemini is skipped.
 */
function createDefaultAnalysis(
  aggregated: ReturnType<typeof aggregateResults>
) {
  return {
    executiveSummary: `Comprehensive eval completed with ${(aggregated.aggregateStats.overallPassRate * 100).toFixed(1)}% overall pass rate across ${aggregated.totalRuns} runs. Gemini analysis was skipped.`,
    keyFindings: [
      `Overall pass rate: ${(aggregated.aggregateStats.overallPassRate * 100).toFixed(1)}%`,
      `Total cases: ${aggregated.aggregateStats.totalCases}`,
      `Configurations tested: ${aggregated.configurations.join(", ")}`,
      `Flaky cases: ${aggregated.caseAnalysis.filter((c) => c.consistency === "flaky").length}`,
      `Failing cases: ${aggregated.caseAnalysis.filter((c) => c.consistency === "stable-fail").length}`,
    ],
    categoryInsights: aggregated.categoryAnalysis.map((cat) => ({
      category: cat.category,
      summary: `${cat.totalCases} cases, ${(cat.avgPassRate * 100).toFixed(1)}% avg pass rate`,
      strengths: [],
      weaknesses:
        cat.problematicCases.length > 0
          ? [
              `${cat.problematicCases.length} problematic cases: ${cat.problematicCases.slice(0, 5).join(", ")}`,
            ]
          : [],
      suggestions: [],
    })),
    recommendations: [],
    riskAssessment: {
      overallRisk:
        aggregated.aggregateStats.overallPassRate >= 0.9
          ? ("low" as const)
          : (aggregated.aggregateStats.overallPassRate >= 0.7
            ? ("medium" as const)
            : ("high" as const)),
      riskFactors: [],
    },
    actionItems: [],
  };
}

// Run main
main().catch((error) => {
  console.error("[comprehensive] Fatal error:", error);
  process.exit(1);
});
