/**
 * Eval runner entry point with CLI argument support.
 *
 * Usage:
 *   bun run evals [options]
 *
 * Options:
 *   --iterations N    Run evals N times (default: 1)
 *   --html            Generate HTML report
 *   --analyze         Run Gemini analysis on results
 *   --with-judge      Enable LLM judge for evidence
 *   --cases IDS       Filter to specific case IDs
 *   --category CAT    Filter by category
 *   --tags TAGS       Filter by tags
 *   --serial          Run sequentially (default: parallel)
 *   --verbose         Detailed output
 *   --help            Show this help
 *
 * Environment variables (CLI flags override these):
 *   EVAL_FIXTURES=1   Enable fixture data
 *   EVAL_IDS          Comma-separated case IDs
 *   EVAL_CATEGORY     Filter by category
 *   EVAL_TAGS         Filter by tags
 *   EVAL_SERIAL=1     Run sequentially
 *   EVAL_VERBOSE=1    Detailed output
 */

import { main } from "./lib/runner";

interface CliOptions {
  iterations: number;
  html: boolean;
  analyze: boolean;
  withJudge: boolean;
  cases: string | undefined;
  category: string | undefined;
  tags: string | undefined;
  serial: boolean;
  verbose: boolean;
}

/**
 * Parse CLI arguments into options object.
 */
function parseArgs(): CliOptions | null {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: bun run evals [options]

Options:
  --iterations N    Run evals N times (default: 1)
  --html            Generate HTML report
  --analyze         Run Gemini analysis on results
  --with-judge      Enable LLM judge for evidence
  --cases IDS       Filter to specific case IDs
  --category CAT    Filter by category
  --tags TAGS       Filter by tags
  --serial          Run sequentially (default: parallel)
  --verbose         Detailed output
  --help            Show this help

Environment variables can also be used:
  EVAL_FIXTURES=1, EVAL_IDS, EVAL_CATEGORY, EVAL_TAGS,
  EVAL_SERIAL=1, EVAL_VERBOSE=1, EVAL_LLM_JUDGE=1
`);
    return null;
  }

  function getValue(flag: string): string | undefined {
    const idx = args.indexOf(flag);
    if (idx === -1 || idx + 1 >= args.length) {
      return undefined;
    }
    const value = args[idx + 1];
    if (value.startsWith("-")) {
      console.error(`Error: ${flag} requires a value, got "${value}"`);
      process.exit(1);
    }
    return value;
  }

  const iterationsStr = getValue("--iterations");
  const iterations = iterationsStr ? Number.parseInt(iterationsStr, 10) : 1;

  if (iterationsStr && (Number.isNaN(iterations) || iterations < 1)) {
    console.error(`Error: --iterations must be a positive integer`);
    process.exit(1);
  }

  return {
    iterations,
    html: args.includes("--html"),
    analyze: args.includes("--analyze"),
    withJudge: args.includes("--with-judge"),
    cases: getValue("--cases"),
    category: getValue("--category"),
    tags: getValue("--tags"),
    serial: args.includes("--serial"),
    verbose: args.includes("--verbose"),
  };
}

/**
 * Apply CLI options to environment variables for the runner.
 */
function applyOptionsToEnv(options: CliOptions): void {
  if (options.withJudge) {
    process.env.EVAL_LLM_JUDGE = "1";
  }
  if (options.cases) {
    process.env.EVAL_IDS = options.cases;
  }
  if (options.category) {
    process.env.EVAL_CATEGORY = options.category;
  }
  if (options.tags) {
    process.env.EVAL_TAGS = options.tags;
  }
  if (options.serial) {
    process.env.EVAL_SERIAL = "1";
  }
  if (options.verbose) {
    process.env.EVAL_VERBOSE = "1";
  }
}

const options = parseArgs();
if (options === null) {
  process.exit(0);
}

applyOptionsToEnv(options);

try {
  await main({
    iterations: options.iterations,
    html: options.html,
    analyze: options.analyze,
  });
} catch (error) {
  console.error("[eval] Fatal error:", error);
  process.exit(1);
}
