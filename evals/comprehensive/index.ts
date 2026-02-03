#!/usr/bin/env bun
/**
 * Comprehensive eval runner - spawns eval runs with different configurations
 * and aggregates results for analysis.
 *
 * Usage:
 *   bun evals/comprehensive/index.ts [options]
 *
 * Options:
 *   --modes <modes>      Comma-separated modes (fixture,live)
 *   --with-judge         Enable LLM judge (default: off)
 *   --iterations <n>     Iterations per mode (default: 1)
 *   --skip-analysis      Skip Gemini analysis
 *   --cases <ids>        Filter to specific case IDs
 *   --help               Show help
 */

import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
/* eslint-disable import/no-nodejs-modules */
import { readdir, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

interface RunConfig {
  name: string;
  env: Record<string, string>;
}

interface CliOptions {
  modes: string[];
  withJudge: boolean;
  iterations: number;
  skipAnalysis: boolean;
  cases?: string;
}

const REPORTS_DIR = "evals/reports";
const OUTPUT_DIR = "evals/comprehensive/reports";

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    modes: ["fixture"],
    withJudge: false,
    iterations: 1,
    skipAnalysis: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      console.log(`
Comprehensive Eval Runner
-------------------------
Runs evals with different configurations and aggregates results.

Options:
  --modes <modes>    Comma-separated: fixture, live (default: fixture)
  --with-judge       Enable LLM judge for semantic matching
  --iterations <n>   Runs per mode (default: 1)
  --skip-analysis    Skip Gemini 2.5 Pro analysis
  --cases <ids>      Filter to specific case IDs
  --help             Show this help
`);
      process.exit(0);
    }
    if (arg === "--modes" && args[i + 1]) {
      options.modes = args[++i].split(",");
    }
    if (arg === "--with-judge") {
      options.withJudge = true;
    }
    if (arg === "--iterations" && args[i + 1]) {
      options.iterations = Number.parseInt(args[++i], 10) || 1;
    }
    if (arg === "--skip-analysis") {
      options.skipAnalysis = true;
    }
    if (arg === "--cases" && args[i + 1]) {
      options.cases = args[++i];
    }
  }
  return options;
}

function buildConfigs(options: CliOptions): RunConfig[] {
  const configs: RunConfig[] = [];

  for (const mode of options.modes) {
    const isFixture = mode === "fixture";
    configs.push({
      name: `${mode}${options.withJudge ? "+judge" : ""}`,
      env: {
        EVAL_USE_BASE: isFixture ? "1" : "0",
        EVAL_LLM_JUDGE: options.withJudge ? "1" : "0",
        EVAL_SERIAL: "1",
        ...(options.cases ? { EVAL_IDS: options.cases } : {}),
      },
    });
  }
  return configs;
}

async function runEvalProcess(config: RunConfig): Promise<string | null> {
  console.log(`[comprehensive] Running: ${config.name}`);

  const proc = Bun.spawn(["bun", "run", "evals"], {
    env: { ...process.env, ...config.env },
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0 && exitCode !== 1) {
    console.error(
      `[comprehensive] ${config.name} failed with code ${exitCode}`
    );
    return null;
  }

  // Find the latest summary report
  const files = await readdir(REPORTS_DIR);
  const summaries = files
    .filter((f) => f.startsWith("summary-"))
    .toSorted()
    .toReversed();

  return summaries[0] ? path.join(REPORTS_DIR, summaries[0]) : null;
}

async function collectResults(reportPaths: string[]): Promise<{
  passed: number;
  failed: number;
  total: number;
  details: unknown[];
}> {
  let passed = 0;
  let failed = 0;
  let total = 0;
  const details: unknown[] = [];

  for (const p of reportPaths) {
    try {
      const content = await readFile(p, "utf8");
      const data = JSON.parse(content);
      passed += data.passed ?? 0;
      failed += data.failed ?? 0;
      total += data.totalCases ?? 0;
      details.push(data);
    } catch {
      console.error(`[comprehensive] Failed to read ${p}`);
    }
  }

  return { passed, failed, total, details };
}

const AnalysisSchema = z.object({
  summary: z.string(),
  findings: z.array(z.string()),
  recommendations: z.array(z.string()),
});

async function analyzeWithGemini(
  results: unknown
): Promise<z.infer<typeof AnalysisSchema> | null> {
  try {
    const response = await generateObject({
      model: google("gemini-2.5-pro-preview-05-06"),
      schema: AnalysisSchema,
      prompt: `Analyze these eval results and provide insights:\n${JSON.stringify(results, null, 2)}`,
    });
    return response.object;
  } catch (error) {
    console.error("[comprehensive] Gemini analysis failed:", error);
    return null;
  }
}

async function main() {
  const options = parseArgs();
  const configs = buildConfigs(options);

  console.log("\n=== COMPREHENSIVE EVAL ===");
  console.log(`Modes: ${options.modes.join(", ")}`);
  console.log(`Judge: ${options.withJudge ? "enabled" : "disabled"}`);
  console.log(`Iterations: ${options.iterations}`);
  console.log("");

  const reportPaths: string[] = [];

  for (const config of configs) {
    for (let i = 0; i < options.iterations; i++) {
      const reportPath = await runEvalProcess(config);
      if (reportPath) {
        reportPaths.push(reportPath);
      }
    }
  }

  if (reportPaths.length === 0) {
    console.error("[comprehensive] No reports collected");
    process.exit(1);
  }

  const results = await collectResults(reportPaths);

  console.log("\n=== RESULTS ===");
  console.log(`Total: ${results.total}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(
    `Pass rate: ${results.total > 0 ? ((results.passed / results.total) * 100).toFixed(1) : 0}%`
  );

  if (!options.skipAnalysis) {
    console.log("\n[comprehensive] Running Gemini analysis...");
    const analysis = await analyzeWithGemini(results);
    if (analysis) {
      console.log("\n=== ANALYSIS ===");
      console.log(analysis.summary);
      console.log("\nFindings:");
      for (const f of analysis.findings) {
        console.log(`  - ${f}`);
      }
      console.log("\nRecommendations:");
      for (const r of analysis.recommendations) {
        console.log(`  - ${r}`);
      }
    }
  }

  // Save report
  await mkdir(OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const reportPath = path.join(OUTPUT_DIR, `report-${timestamp}.json`);
  await Bun.write(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nReport saved: ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
