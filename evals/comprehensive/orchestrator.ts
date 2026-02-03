/**
 * Orchestrates multiple eval runs with different configurations.
 */

import { createRunId } from "../lib/reporter";
import { runEvals } from "../lib/runner";
import { getConfigurationByMode } from "./config";
import { type RunMode, type SingleRunResult } from "./types";

interface OrchestratorOptions {
  modes: RunMode[];
  iterations: number;
  caseIds?: string;
  categories?: string;
  verbose?: boolean;
}

/**
 * Set environment variables for a run configuration.
 */
function setEnvironment(env: Record<string, string>): void {
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
}

/**
 * Clear eval-related environment variables between runs.
 */
function clearEvalEnvironment(): void {
  const evalVars = [
    "EVAL_USE_BASE",
    "EVAL_USE_FIXTURES",
    "EVAL_LLM_JUDGE",
    "EVAL_SERIAL",
    "EVAL_IDS",
    "EVAL_CATEGORY",
    "EVAL_TAGS",
    "EVAL_LIMIT",
    "EVAL_VERBOSE",
  ];
  for (const varName of evalVars) {
    delete process.env[varName];
  }
}

/**
 * Execute a single eval run with a specific configuration.
 */
async function executeSingleRun(
  mode: RunMode,
  iteration: number,
  options: OrchestratorOptions
): Promise<SingleRunResult> {
  const config = getConfigurationByMode(mode);
  const startTime = new Date().toISOString();
  const startMs = performance.now();

  console.log(
    `\n[comprehensive] Starting run: ${config.name} (iteration ${iteration + 1})`
  );
  console.log(`[comprehensive] ${config.description}`);

  clearEvalEnvironment();
  setEnvironment(config.env);

  if (options.caseIds) {
    process.env.EVAL_IDS = options.caseIds;
  }
  if (options.categories) {
    process.env.EVAL_CATEGORY = options.categories;
  }
  if (options.verbose) {
    process.env.EVAL_VERBOSE = "1";
  }

  const result = await runEvals({
    manageServer: true,
    verbose: options.verbose,
  });

  const endTime = new Date().toISOString();
  const durationMs = Math.round(performance.now() - startMs);

  console.log(
    `[comprehensive] Completed: ${config.name} - ${result.summary.passed}/${result.summary.totalCases} passed (${durationMs}ms)`
  );

  return {
    mode,
    runId: result.summary.runId,
    summary: result.summary,
    reports: result.reports,
    startTime,
    endTime,
    durationMs,
  };
}

/**
 * Orchestrate all eval runs across configurations and iterations.
 */
export async function orchestrateRuns(
  options: OrchestratorOptions
): Promise<SingleRunResult[]> {
  const orchestrationId = createRunId();
  console.log(`\n${"=".repeat(70)}`);
  console.log("COMPREHENSIVE EVAL ORCHESTRATION");
  console.log(`${"=".repeat(70)}`);
  console.log(`Orchestration ID: ${orchestrationId}`);
  console.log(`Modes: ${options.modes.join(", ")}`);
  console.log(`Iterations per mode: ${options.iterations}`);
  console.log(`Total runs: ${options.modes.length * options.iterations}`);
  console.log(`${"=".repeat(70)}\n`);

  const allResults: SingleRunResult[] = [];

  for (const mode of options.modes) {
    for (let i = 0; i < options.iterations; i++) {
      try {
        const result = await executeSingleRun(mode, i, options);
        allResults.push(result);
      } catch (error) {
        console.error(
          `[comprehensive] Error in ${mode} iteration ${i + 1}:`,
          error
        );
      }
    }
  }

  clearEvalEnvironment();

  console.log(`\n${"=".repeat(70)}`);
  console.log("ORCHESTRATION COMPLETE");
  console.log(`${"=".repeat(70)}`);
  console.log(`Total runs completed: ${allResults.length}`);

  return allResults;
}
