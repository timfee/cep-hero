/**
 * Eval registry loading and filtering.
 * Standalone module without test framework dependencies.
 */

/* eslint-disable import/no-nodejs-modules */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface EvalRubric {
  min_score: number;
  criteria: string[];
}

/**
 * A single turn in a multi-turn conversation eval.
 */
export interface ConversationTurn {
  role: "user";
  content: string;
}

/**
 * Assertions for a specific turn in a multi-turn conversation.
 */
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
  /** Multi-turn conversation script for hero workflows */
  conversation_script: ConversationTurn[];
  /** Per-turn assertions for multi-turn evals */
  turn_assertions?: TurnAssertion[];
  expected_schema: string[];
  fixtures?: string[];
  overrides?: string[];
  required_evidence?: string[];
  /** Tools that MUST be called for this eval to pass (e.g., ["getChromeEvents"]) */
  required_tool_calls?: string[];
  rubric?: EvalRubric;
  assertions: unknown[];
  cleanup: unknown[];
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

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEvalRegistry(value: unknown): value is EvalRegistry {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.version === "string" && Array.isArray(value.cases);
}

/**
 * Load the eval registry from disk.
 */
export function loadEvalRegistry(
  registryPath: string = path.join(process.cwd(), "evals", "registry.json")
): EvalRegistry {
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
 * Filter eval cases based on provided options.
 */
export function filterEvalCases(
  cases: EvalCase[],
  options: FilterOptions
): EvalCase[] {
  let filtered = cases;

  if (isNonEmptyString(options.ids)) {
    const idSet = new Set(options.ids.split(",").map((id) => id.trim()));
    filtered = filtered.filter((c) => idSet.has(c.id));
  }

  if (isNonEmptyString(options.categories)) {
    const categorySet = new Set(
      options.categories.split(",").map((cat) => cat.trim().toLowerCase())
    );
    filtered = filtered.filter((c) =>
      categorySet.has(c.category.toLowerCase())
    );
  }

  if (isNonEmptyString(options.tags)) {
    const tagSet = new Set(
      options.tags.split(",").map((tag) => tag.trim().toLowerCase())
    );
    filtered = filtered.filter((c) =>
      c.tags.some((tag) => tagSet.has(tag.toLowerCase()))
    );
  }

  if (isNonEmptyString(options.limit)) {
    const limit = Number.parseInt(options.limit, 10);
    if (!Number.isNaN(limit) && limit > 0) {
      filtered = filtered.slice(0, limit);
    }
  }

  return filtered;
}

/**
 * Build a map of case ID to prompt text extracted from case files.
 */
export function buildPromptMap(
  registry: EvalRegistry,
  rootDir: string = process.cwd()
): Map<string, string> {
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
 * Looks for content between "## Conversation" and the next heading or end.
 */
function extractPromptFromMarkdown(content: string): string | undefined {
  const conversationMatch = content.match(
    /##\s*Conversation\s*\n([\s\S]*?)(?=\n##|\n$|$)/i
  );
  if (!conversationMatch) {
    return undefined;
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
export function getCategories(registry: EvalRegistry): string[] {
  const categories = new Set<string>();
  for (const evalCase of registry.cases) {
    categories.add(evalCase.category);
  }
  return [...categories].toSorted();
}

/**
 * Get unique tags from the registry.
 */
export function getTags(registry: EvalRegistry): string[] {
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
export function getCasesByCategory(
  registry: EvalRegistry
): Map<string, EvalCase[]> {
  const byCategory = new Map<string, EvalCase[]>();
  for (const evalCase of registry.cases) {
    const existing = byCategory.get(evalCase.category) ?? [];
    existing.push(evalCase);
    byCategory.set(evalCase.category, existing);
  }
  return byCategory;
}
