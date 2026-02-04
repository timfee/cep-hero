/**
 * Eval registry loading and filtering without test framework dependencies.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { isNonEmptyString, isPlainObject } from "./utils";

export interface EvalRubric {
  min_score: number;
  criteria: string[];
}

export interface ConversationTurn {
  role: "user";
  content: string;
}

export interface TurnAssertion {
  turn: number;
  required_tool_calls?: string[];
  required_evidence?: string[];
}

export interface EvalCase {
  id: string;
  title: string;
  category: string;
  source_refs: string[];
  case_file: string;
  mode: string;
  tags: string[];
  conversation_script: ConversationTurn[];
  turn_assertions?: TurnAssertion[];
  expected_schema: string[];
  fixtures?: string[];
  overrides?: string[];
  required_evidence?: string[];
  required_tool_calls?: string[];
  rubric?: EvalRubric;
}

export interface EvalRegistry {
  version: string;
  cases: EvalCase[];
}

export interface FilterOptions {
  ids?: string;
  categories?: string;
  tags?: string;
  limit?: string;
}

/**
 * Type guard for valid eval registry structure.
 */
function isEvalRegistry(value: unknown): value is EvalRegistry {
  if (!isPlainObject(value)) {
    return false;
  }
  return typeof value.version === "string" && Array.isArray(value.cases);
}

/**
 * Load the eval registry from disk.
 */
export function loadEvalRegistry(
  registryPath: string = path.join(process.cwd(), "evals", "registry.json")
) {
  if (!existsSync(registryPath)) {
    throw new Error(`Registry not found: ${registryPath}`);
  }
  const contents = readFileSync(registryPath, "utf8");
  const parsed: unknown = JSON.parse(contents);
  if (!isEvalRegistry(parsed)) {
    throw new Error("Invalid eval registry format");
  }
  return parsed;
}

/**
 * Filter cases by comma-separated ID list.
 */
function filterById(cases: EvalCase[], ids: string | undefined) {
  if (!isNonEmptyString(ids)) {
    return cases;
  }
  const idSet = new Set(ids.split(",").map((id) => id.trim()));
  return cases.filter((c) => idSet.has(c.id));
}

/**
 * Filter cases by comma-separated category list.
 */
function filterByCategory(cases: EvalCase[], categories: string | undefined) {
  if (!isNonEmptyString(categories)) {
    return cases;
  }
  const categorySet = new Set(
    categories.split(",").map((cat) => cat.trim().toLowerCase())
  );
  return cases.filter((c) => categorySet.has(c.category.toLowerCase()));
}

/**
 * Filter cases by comma-separated tag list.
 */
function filterByTags(cases: EvalCase[], tags: string | undefined) {
  if (!isNonEmptyString(tags)) {
    return cases;
  }
  const tagSet = new Set(
    tags.split(",").map((tag) => tag.trim().toLowerCase())
  );
  return cases.filter((c) =>
    c.tags.some((tag) => tagSet.has(tag.toLowerCase()))
  );
}

/**
 * Limit the number of cases returned.
 */
function applyLimit(cases: EvalCase[], limit: string | undefined) {
  if (!isNonEmptyString(limit)) {
    return cases;
  }
  const parsed = Number.parseInt(limit, 10);
  return !Number.isNaN(parsed) && parsed > 0 ? cases.slice(0, parsed) : cases;
}

/**
 * Filter eval cases based on provided options.
 */
export function filterEvalCases(cases: EvalCase[], options: FilterOptions) {
  let filtered = filterById(cases, options.ids);
  filtered = filterByCategory(filtered, options.categories);
  filtered = filterByTags(filtered, options.tags);
  return applyLimit(filtered, options.limit);
}

/**
 * Build a map of case ID to prompt text extracted from case files.
 */
export function buildPromptMap(
  registry: EvalRegistry,
  rootDir: string = process.cwd()
) {
  const map = new Map<string, string>();

  for (const evalCase of registry.cases) {
    const caseFilePath = path.join(rootDir, evalCase.case_file);
    if (!existsSync(caseFilePath)) {
      continue;
    }

    const content = readFileSync(caseFilePath, "utf8");
    const prompt = extractPromptFromMarkdown(content);
    if (typeof prompt === "string" && prompt.length > 0) {
      map.set(evalCase.id, prompt);
    }
  }

  return map;
}

/**
 * Extract the user prompt from a case markdown file.
 */
function extractPromptFromMarkdown(content: string) {
  const conversationMatch = content.match(
    /##\s*Conversation\s*\n([\s\S]*?)(?=\n##|\n$|$)/i
  );
  if (!conversationMatch) {
    return;
  }

  const section = conversationMatch[1].trim();
  const userMatch = section.match(
    /\*\*User(?:\s*\([^)]*\))?:\*\*\s*([\s\S]*?)(?=\n\*\*|$)/i
  );
  if (userMatch) {
    return userMatch[1].trim();
  }

  return section || undefined;
}

/**
 * Get unique categories from the registry.
 */
export function getCategories(registry: EvalRegistry) {
  const categories = new Set<string>();
  for (const evalCase of registry.cases) {
    categories.add(evalCase.category);
  }
  return [...categories].toSorted();
}

/**
 * Get unique tags from the registry.
 */
export function getTags(registry: EvalRegistry) {
  const tags = new Set<string>();
  for (const evalCase of registry.cases) {
    for (const tag of evalCase.tags) {
      tags.add(tag);
    }
  }
  return [...tags].toSorted();
}

/**
 * Get cases grouped by category.
 */
export function getCasesByCategory(registry: EvalRegistry) {
  const byCategory = new Map<string, EvalCase[]>();
  for (const evalCase of registry.cases) {
    const existing = byCategory.get(evalCase.category) ?? [];
    existing.push(evalCase);
    byCategory.set(evalCase.category, existing);
  }
  return byCategory;
}
