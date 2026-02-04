#!/usr/bin/env bun
/**
 * Eval runner entry point that supports filtering by case ID, category, or tag.
 *
 * Environment variables:
 *   EVAL_IDS           - Comma-separated case IDs to run
 *   EVAL_CATEGORY      - Filter by category
 *   EVAL_TAGS          - Filter by tags
 *   EVAL_LIMIT         - Maximum number of cases to run
 *   EVAL_SERIAL        - Set to "1" for serial execution
 *   EVAL_FIXTURES      - Set to "1" to enable all fixtures (recommended)
 *   EVAL_VERBOSE       - Set to "1" for verbose output
 *   EVAL_MANAGE_SERVER - Set to "0" to skip server management
 *   CHAT_URL           - Override chat API URL
 */

import { main } from "./lib/runner";

try {
  await main();
} catch (error) {
  console.error("[eval] Fatal error:", error);
  process.exit(1);
}
