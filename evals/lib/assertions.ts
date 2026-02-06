/**
 * Standalone assertion helpers for eval cases that return results rather than throwing.
 * This allows the eval runner to collect and report on all assertions without test framework dependency.
 */

import { isPlainObject, normalizeForMatching } from "./utils";

export interface AssertionResult {
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
}

const schemaKeyMap: Record<string, string> = {
  diagnosis: "diagnosis",
  evidence: "evidence",
  hypotheses: "hypotheses",
  next_steps: "nextSteps",
  reference: "reference",
};

/**
 * Check if response metadata contains expected schema keys.
 */
export function checkStructuredResponse({
  text,
  metadata,
  expectedSchema,
}: {
  text: string;
  metadata: unknown;
  expectedSchema: string[];
}): AssertionResult {
  const schemaMatched = hasExpectedSchema(metadata, expectedSchema);
  if (schemaMatched) {
    return {
      passed: true,
      message: "Response contains expected schema in metadata",
      details: { expectedSchema, source: "metadata" },
    };
  }

  const textResult = checkStructuredText(text, expectedSchema);
  if (textResult.passed) {
    return {
      passed: true,
      message: "Response contains expected structure in text",
      details: { expectedSchema, source: "text" },
    };
  }

  return {
    passed: false,
    message: `Response missing expected schema: ${expectedSchema.join(", ")}`,
    details: { expectedSchema, textResult },
  };
}

/**
 * Check if metadata object has all expected schema keys.
 */
function hasExpectedSchema(metadata: unknown, expected: string[]) {
  if (!isPlainObject(metadata)) {
    return false;
  }
  return expected.every((key) => {
    const mapped = schemaKeyMap[key] ?? key;
    return Object.hasOwn(metadata, mapped);
  });
}

/**
 * Check if text contains structural signals indicating a valid diagnostic response.
 */
function checkStructuredText(
  text: string,
  expected: string[]
): AssertionResult {
  const lower = text.toLowerCase();
  const signals = [
    "diagnosis",
    "evidence",
    "hypothesis",
    "next",
    "reference",
    "found",
    "issue",
    "cause",
    "recommend",
    "steps",
    "suggest",
    "check",
    "error",
    "configur",
    "investigat",
  ];
  const matches = signals.filter((signal) => lower.includes(signal)).length;

  if (expected.length === 0 && lower.length > 0) {
    return { passed: true, message: "Non-empty response" };
  }

  if (lower.length > 20 && matches >= 1) {
    return {
      passed: true,
      message: `Found ${matches} structural signals in text`,
      details: { matches },
    };
  }

  return {
    passed: false,
    message: `Insufficient structure: length=${lower.length}, signals=${matches}`,
  };
}

/**
 * Check for required evidence markers in response using fuzzy matching.
 */
export function checkRequiredEvidence({
  text,
  metadata,
  requiredEvidence,
}: {
  text: string;
  metadata: unknown;
  requiredEvidence: string[] | undefined;
}): AssertionResult {
  if (requiredEvidence === undefined || requiredEvidence.length === 0) {
    return { passed: true, message: "No required evidence specified" };
  }

  const metadataText =
    metadata !== undefined && metadata !== null ? JSON.stringify(metadata) : "";
  const combined = normalizeForMatching(`${text}\n${metadataText}`);

  const missing = requiredEvidence.filter(
    (needle) => !combined.includes(normalizeForMatching(needle))
  );

  if (missing.length === 0) {
    return {
      passed: true,
      message: "All required evidence found",
      details: { requiredEvidence },
    };
  }

  return {
    passed: false,
    message: `Missing required evidence: ${missing.join(", ")}`,
    details: { requiredEvidence, missing },
  };
}

/**
 * Score rubric criteria by checking for required cues in the response.
 */
export function scoreRubric({
  text,
  metadata,
  criteria,
}: {
  text: string;
  metadata: unknown;
  criteria: string[];
}) {
  const combined = normalizeForMatching(
    `${text}\n${
      metadata !== undefined && metadata !== null
        ? JSON.stringify(metadata)
        : ""
    }`
  );

  const matched: string[] = [];
  const missed: string[] = [];

  for (const criterion of criteria) {
    if (combined.includes(normalizeForMatching(criterion))) {
      matched.push(criterion);
    } else {
      missed.push(criterion);
    }
  }

  return { score: matched.length, matched, missed };
}

/**
 * Check if required tools were called during the eval.
 */
export function checkRequiredToolCalls({
  toolCalls,
  requiredToolCalls,
}: {
  toolCalls: string[] | undefined;
  requiredToolCalls: string[] | undefined;
}): AssertionResult {
  if (requiredToolCalls === undefined || requiredToolCalls.length === 0) {
    return { passed: true, message: "No required tool calls specified" };
  }

  const called = new Set(toolCalls);
  const missing = requiredToolCalls.filter((tool) => !called.has(tool));

  if (missing.length === 0) {
    return {
      passed: true,
      message: `All required tools called: ${requiredToolCalls.join(", ")}`,
      details: { requiredToolCalls, actualToolCalls: toolCalls },
    };
  }

  return {
    passed: false,
    message: `Missing required tool calls: ${missing.join(", ")}`,
    details: { requiredToolCalls, actualToolCalls: toolCalls, missing },
  };
}

/**
 * Check if rubric score meets minimum threshold.
 */
export function checkRubricScore({
  score,
  minScore,
  criteria,
}: {
  score: number;
  minScore: number;
  criteria: string[];
}): AssertionResult {
  if (score >= minScore) {
    return {
      passed: true,
      message: `Rubric score ${score}/${criteria.length} meets minimum ${minScore}`,
      details: { score, minScore, total: criteria.length },
    };
  }

  return {
    passed: false,
    message: `Rubric score ${score}/${criteria.length} below minimum ${minScore}`,
    details: { score, minScore, total: criteria.length },
  };
}

/**
 * Check that forbidden evidence does NOT appear in response (negative test cases).
 */
export function checkForbiddenEvidence({
  text,
  metadata,
  forbiddenEvidence,
}: {
  text: string;
  metadata: unknown;
  forbiddenEvidence: string[] | undefined;
}): AssertionResult {
  if (forbiddenEvidence === undefined || forbiddenEvidence.length === 0) {
    return { passed: true, message: "No forbidden evidence specified" };
  }

  const metadataText =
    metadata !== undefined && metadata !== null ? JSON.stringify(metadata) : "";
  const combined = normalizeForMatching(`${text}\n${metadataText}`);

  const found = forbiddenEvidence.filter((needle) =>
    combined.includes(normalizeForMatching(needle))
  );

  if (found.length === 0) {
    return {
      passed: true,
      message: "No forbidden evidence found",
      details: { forbiddenEvidence },
    };
  }

  return {
    passed: false,
    message: `Found forbidden evidence: ${found.join(", ")}`,
    details: { forbiddenEvidence, found },
  };
}
