/**
 * LLM-as-judge for semantic evidence evaluation.
 * Batches multiple cases for token efficiency using structured outputs.
 */

import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

/**
 * Process up to 10 cases per LLM call
 */
const BATCH_SIZE = 10;

export interface EvidenceCheckInput {
  caseId: string;
  responseText: string;
  requiredEvidence: string[];
}

export interface EvidenceCheckResult {
  caseId: string;
  passed: boolean;
  reasoning: string;
  presentEvidence: string[];
  missingEvidence: string[];
}

const EvidenceResultSchema = z.object({
  results: z.array(
    z.object({
      caseId: z.string().describe("The case ID being evaluated"),
      passed: z
        .boolean()
        .describe("True if all required evidence concepts are addressed"),
      reasoning: z
        .string()
        .describe("Brief explanation of the evaluation (1-2 sentences)"),
      presentEvidence: z
        .array(z.string())
        .describe("Evidence concepts that ARE present in the response"),
      missingEvidence: z
        .array(z.string())
        .describe("Evidence concepts that are NOT adequately addressed"),
    })
  ),
});

/**
 * Evaluate evidence presence using LLM-as-judge.
 * Batches cases for token efficiency.
 */
export async function batchEvaluateEvidence(
  inputs: EvidenceCheckInput[]
): Promise<Map<string, EvidenceCheckResult>> {
  const results = new Map<string, EvidenceCheckResult>();

  // Process in batches
  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const batch = inputs.slice(i, i + BATCH_SIZE);
    const batchResults = await evaluateBatch(batch);
    for (const result of batchResults) {
      results.set(result.caseId, result);
    }
  }

  return results;
}

async function evaluateBatch(
  batch: EvidenceCheckInput[]
): Promise<EvidenceCheckResult[]> {
  if (batch.length === 0) {
    return [];
  }

  const casesDescription = batch
    .map(
      (c, idx) => `
### Case ${idx + 1}: ${c.caseId}
**Required Evidence Concepts:** ${c.requiredEvidence.join(", ")}

**Response to Evaluate:**
${c.responseText.slice(0, 1500)}
`
    )
    .join("\n---\n");

  const prompt = `You are an eval judge. For each case below, determine if the response adequately addresses the required evidence concepts.

Evidence matching rules:
- Concepts can be addressed through synonyms, paraphrasing, or semantic equivalence
- "wifi" matches "Wi-Fi", "wireless network", etc.
- "deauth" matches "deauthentication", "disconnection", "authentication failure", "handshake timeout"
- "license" matches "licensing", "subscription", "enterprise license"
- Error codes like "ERR_NAME_NOT_RESOLVED" should be cited exactly OR explained (e.g., "DNS resolution failed")
- Technical terms can be explained rather than quoted verbatim

Be lenient on exact wording but strict on conceptual coverage.

${casesDescription}

Evaluate each case and return structured results.`;

  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const response = await generateObject({
      model: google("gemini-2.0-flash-001"),
      schema: EvidenceResultSchema,
      prompt,
    });

    return response.object.results;
  } catch (error) {
    console.error("LLM judge batch evaluation failed:", error);
    // Return failures for all cases in batch on error
    return batch.map((c) => ({
      caseId: c.caseId,
      passed: false,
      reasoning: "LLM evaluation failed",
      presentEvidence: [],
      missingEvidence: c.requiredEvidence,
    }));
  }
}

/**
 * Evaluate a single case (convenience wrapper).
 */
export async function evaluateEvidence(
  input: EvidenceCheckInput
): Promise<EvidenceCheckResult> {
  const results = await batchEvaluateEvidence([input]);
  return (
    results.get(input.caseId) ?? {
      caseId: input.caseId,
      passed: false,
      reasoning: "Evaluation returned no result",
      presentEvidence: [],
      missingEvidence: input.requiredEvidence,
    }
  );
}
