#!/usr/bin/env bun
/**
 * One-time migration script to update registry.json with new failure-domain categories.
 * Run with: bun scripts/migrate-registry-categories.ts
 */

import { readFileSync, writeFileSync } from "fs";
import path from "path";

import { CASE_CATEGORY_MAP } from "../evals/lib/categories";

const registryPath = path.join(process.cwd(), "evals", "registry.json");

type EvalCase = {
  id: string;
  title: string;
  category: string;
  source_refs: string[];
  [key: string]: unknown;
};

type Registry = {
  version: string;
  cases: EvalCase[];
};

function migrate(): void {
  console.log("Loading registry...");
  const content = readFileSync(registryPath, "utf-8");
  const registry = JSON.parse(content) as Registry;

  console.log(`Found ${registry.cases.length} cases`);

  let updated = 0;
  for (const evalCase of registry.cases) {
    const newCategory = CASE_CATEGORY_MAP[evalCase.id];
    if (newCategory && evalCase.category !== newCategory) {
      console.log(`  ${evalCase.id}: ${evalCase.category} -> ${newCategory}`);
      evalCase.category = newCategory;
      updated++;
    } else if (!newCategory) {
      console.log(
        `  ${evalCase.id}: no mapping found, keeping ${evalCase.category}`
      );
    }
  }

  console.log(`\nUpdated ${updated} cases`);

  // Update version to indicate migration
  registry.version = "2.0.0";

  console.log("Writing updated registry...");
  writeFileSync(
    registryPath,
    JSON.stringify(registry, null, 2) + "\n",
    "utf-8"
  );
  console.log("Done!");
}

migrate();
