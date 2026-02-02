/**
 * Eval assertions - standalone assertion helpers without test framework dependency.
 * These return results rather than throwing, allowing the eval runner to collect
 * and report on all assertions.
 */

export type AssertionResult = {
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
};

const schemaKeyMap: Record<string, string> = {
  diagnosis: "diagnosis",
  evidence: "evidence",
  hypotheses: "hypotheses",
  next_steps: "nextSteps",
  reference: "reference",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

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

function hasExpectedSchema(metadata: unknown, expected: string[]): boolean {
  if (!isRecord(metadata)) return false;
  return expected.every((key) => {
    const mapped = schemaKeyMap[key] ?? key;
    return Object.prototype.hasOwnProperty.call(metadata, mapped);
  });
}

function checkStructuredText(
  text: string,
  expected: string[]
): AssertionResult {
  const lower = text.toLowerCase();
  const signals = ["diagnosis", "evidence", "hypothesis", "next", "reference"];
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
 * Check for required evidence markers in response.
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
  if (!requiredEvidence || requiredEvidence.length === 0) {
    return { passed: true, message: "No required evidence specified" };
  }

  const lowerText = text.toLowerCase();
  const metadataText = metadata ? JSON.stringify(metadata).toLowerCase() : "";
  const combined = `${lowerText}\n${metadataText}`;

  const missing = requiredEvidence.filter(
    (needle) => !combined.includes(needle.toLowerCase())
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
}): { score: number; matched: string[]; missed: string[] } {
  const combined = `${text.toLowerCase()}\n${metadata ? JSON.stringify(metadata).toLowerCase() : ""}`;

  const matched: string[] = [];
  const missed: string[] = [];

  for (const criterion of criteria) {
    if (combined.includes(criterion.toLowerCase())) {
      matched.push(criterion);
    } else {
      missed.push(criterion);
    }
  }

  return { score: matched.length, matched, missed };
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
