#!/usr/bin/env bun
/**
 * Eval runner entry point.
 *
 * Usage:
 *   bun evals/run.ts                    # Run all evals
 *   EVAL_IDS=EC-001,EC-002 bun evals/run.ts  # Run specific cases
 *   EVAL_CATEGORY=connector bun evals/run.ts  # Run by category
 *   EVAL_TAGS=enrollment bun evals/run.ts  # Run by tag
 *
 * Environment variables:
 *   EVAL_IDS          - Comma-separated case IDs to run
 *   EVAL_CATEGORY     - Filter by category
 *   EVAL_TAGS         - Filter by tags
 *   EVAL_LIMIT        - Maximum number of cases to run
 *   EVAL_SERIAL       - Set to "1" for serial execution
 *   EVAL_USE_BASE     - Set to "1" to load base fixtures
 *   EVAL_USE_FIXTURES - Set to "1" to load case-specific fixtures
 *   EVAL_VERBOSE      - Set to "1" for verbose output
 *   EVAL_MANAGE_SERVER - Set to "0" to skip server management
 *   CHAT_URL          - Override chat API URL
 */

import { main } from "./lib/runner";

try {
  await main();
} catch (error) {
  console.error("[eval] Fatal error:", error);
  process.exit(1);
}
