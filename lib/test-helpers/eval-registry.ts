import { existsSync, readFileSync } from "fs";
import path from "path";

/** Supported eval categories for registry cases. */
export type EvalCategory = "common_challenges" | "diagnostics" | "test_plan";

/** Evaluation modes used for gating. */
export type EvalMode = "deterministic" | "rubric";

/** Registry entry describing a single eval case. */
export type RegistryCase = {
  id: string;
  title: string;
  category: EvalCategory;
  source_refs: string[];
  case_file: string;
  mode: EvalMode;
  requires_live_data: boolean;
  tags: string[];
  expected_schema: string[];
  fixtures?: string[];
  required_evidence?: string[];
  rubric?: {
    min_score: number;
    criteria: string[];
  };
};

/** Registry payload containing all eval cases. */
export type Registry = {
  version: string;
  cases: RegistryCase[];
};

type EvalCaseFilterOptions = {
  ids?: string;
  categories?: string;
  tags?: string;
  limit?: string | number | null;
};

const REGISTRY_RELATIVE_PATH = path.join("evals", "registry.json");
const CASES_RELATIVE_DIR = path.join("evals", "cases");

const DEFAULT_REGISTRY_PATH = path.join(
  resolveRepoRoot(process.cwd()),
  REGISTRY_RELATIVE_PATH
);

/** Load the eval registry from disk and validate its schema. */
export function loadEvalRegistry(
  registryPath: string = DEFAULT_REGISTRY_PATH
): Registry {
  const raw = readFileSync(registryPath, "utf-8");
  const data = JSON.parse(raw);
  return parseRegistry(data);
}

/** Return cases that are runnable in live mode by default. */
export function getRunnableCases(registry: Registry): RegistryCase[] {
  return registry.cases.filter((item) => item.category !== "common_challenges");
}

/** Build a prompt map keyed by eval ID using case markdown. */
export function buildPromptMap(
  registry: Registry,
  rootDir: string = resolveRepoRoot(process.cwd())
): Map<string, string> {
  const promptMap = new Map<string, string>();
  for (const item of registry.cases) {
    const casePath = resolveCaseFilePath(rootDir, item.case_file);
    const contents = readFileSync(casePath, "utf-8");
    const prompts = extractPrompts(contents);
    if (prompts.length > 0) {
      promptMap.set(item.id, prompts[0]);
    }
  }
  return promptMap;
}

/** Filter cases by env-driven selectors (IDs, categories, tags, limit). */
export function filterEvalCases(
  cases: RegistryCase[],
  options: EvalCaseFilterOptions
): RegistryCase[] {
  const filterIds = new Set(parseCsv(options.ids));
  const filterCategories = new Set(parseCsv(options.categories));
  const filterTags = new Set(parseCsv(options.tags));
  const limit = parseLimit(options.limit);

  const filtered = cases
    .filter((item) => {
      if (filterIds.size > 0 && !filterIds.has(item.id)) return false;
      if (filterCategories.size > 0 && !filterCategories.has(item.category)) {
        return false;
      }
      if (filterTags.size > 0) {
        const tagMatch = item.tags.some((tag) => filterTags.has(tag));
        if (!tagMatch) return false;
      }
      return true;
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  if (limit !== null && Number.isFinite(limit)) {
    return filtered.slice(0, limit);
  }

  return filtered;
}

function parseRegistry(data: unknown): Registry {
  if (!isRecord(data)) {
    throw new Error("Registry payload must be an object.");
  }

  const version = getString(data, "version", "Registry version");
  const casesValue = data.cases;

  if (!Array.isArray(casesValue)) {
    throw new Error("Registry cases must be an array.");
  }

  const cases = casesValue.map((item, index) => parseRegistryCase(item, index));

  return { version, cases };
}

function parseRegistryCase(value: unknown, index: number): RegistryCase {
  if (!isRecord(value)) {
    throw new Error(`Registry case at index ${index} must be an object.`);
  }

  const id = getString(value, "id", `Case ${index} id`);
  const title = getString(value, "title", `Case ${id} title`);
  const category = getEnum(value, "category", [
    "common_challenges",
    "diagnostics",
    "test_plan",
  ]);
  const source_refs = getStringArray(value, "source_refs");
  const case_file = getString(value, "case_file", `Case ${id} case_file`);
  const mode = getEnum(value, "mode", ["deterministic", "rubric"]);
  const requires_live_data = getBoolean(
    value,
    "requires_live_data",
    `Case ${id} requires_live_data`
  );
  const tags = getStringArray(value, "tags");
  const expected_schema = getStringArray(value, "expected_schema");
  const fixtures = getOptionalStringArray(value, "fixtures");
  const required_evidence = getOptionalStringArray(value, "required_evidence");
  const rubric = getOptionalRubric(value, `Case ${id} rubric`);

  return {
    id,
    title,
    category,
    source_refs,
    case_file,
    mode,
    requires_live_data,
    tags,
    expected_schema,
    fixtures,
    required_evidence,
    rubric,
  };
}

function resolveRepoRoot(startDir: string): string {
  let current = startDir;
  while (true) {
    const candidate = path.join(current, REGISTRY_RELATIVE_PATH);
    if (existsSync(candidate)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return startDir;
    }
    current = parent;
  }
}

function resolveCaseFilePath(rootDir: string, caseFile: string): string {
  if (path.isAbsolute(caseFile)) {
    return caseFile;
  }
  const normalized = caseFile.replace(/\\/g, "/");
  if (normalized.startsWith("evals/cases/")) {
    return path.join(rootDir, caseFile);
  }
  return path.join(rootDir, CASES_RELATIVE_DIR, caseFile);
}

function extractPrompts(markdown: string): string[] {
  const prompts: string[] = [];
  const lines = markdown.split("\n");
  for (const line of lines) {
    if (!line.trim().startsWith("User:")) continue;
    const normalized = normalizePrompt(line);
    if (normalized) {
      prompts.push(normalized.replace(/^“|”$/g, ""));
    }
  }
  return prompts;
}

function normalizePrompt(prompt: string): string {
  return prompt.replace(/^User:\s*/i, "").trim();
}

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseLimit(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(
  value: Record<string, unknown>,
  key: string,
  label: string
): string {
  const entry = value[key];
  if (typeof entry !== "string" || entry.trim() === "") {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return entry;
}

function getBoolean(
  value: Record<string, unknown>,
  key: string,
  label: string
): boolean {
  const entry = value[key];
  if (typeof entry !== "boolean") {
    throw new Error(`${label} must be a boolean.`);
  }
  return entry;
}

function getEnum<T extends string>(
  value: Record<string, unknown>,
  key: string,
  allowed: readonly T[]
): T {
  const entry = value[key];
  if (typeof entry !== "string" || !allowed.includes(entry as T)) {
    throw new Error(`${key} must be one of: ${allowed.join(", ")}.`);
  }
  return entry as T;
}

function getStringArray(value: Record<string, unknown>, key: string): string[] {
  const entry = value[key];
  if (
    !Array.isArray(entry) ||
    !entry.every((item) => typeof item === "string")
  ) {
    throw new Error(`${key} must be an array of strings.`);
  }
  return entry;
}

function getOptionalStringArray(
  value: Record<string, unknown>,
  key: string
): string[] | undefined {
  if (!(key in value)) {
    return undefined;
  }
  return getStringArray(value, key);
}

function getOptionalRubric(
  value: Record<string, unknown>,
  label: string
): { min_score: number; criteria: string[] } | undefined {
  const entry = value.rubric;
  if (entry === undefined) {
    return undefined;
  }
  if (!isRecord(entry)) {
    throw new Error(`${label} must be an object.`);
  }
  const minScore = entry.min_score;
  if (typeof minScore !== "number" || minScore < 0) {
    throw new Error(`${label}.min_score must be a non-negative number.`);
  }
  const criteria = getStringArray(entry, "criteria");
  return { min_score: minScore, criteria };
}
