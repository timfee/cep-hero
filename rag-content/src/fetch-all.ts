/**
 * Orchestrator that runs all content fetchers sequentially.
 */

import { main as fetchPolicies } from "./fetch-policies.js";
import { main as fetchHelpcenter } from "./fetch-helpcenter.js";
import { main as fetchCloud } from "./fetch-cloud.js";

/**
 * Run all content fetchers in sequence.
 */
async function main(): Promise<void> {
  console.log("=== Fetching policies ===\n");
  await fetchPolicies();

  console.log("\n=== Fetching help center articles ===\n");
  await fetchHelpcenter();

  console.log("\n=== Fetching cloud docs ===\n");
  await fetchCloud();

  console.log("\n=== All content fetched ===");
}

main().catch(console.error);
