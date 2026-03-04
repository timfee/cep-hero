/**
 * LLM-as-judge for semantic evidence evaluation that batches multiple cases for token efficiency.
 */

import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";

/** Maximum number of cases to evaluate in a single LLM call. */
const BATCH_SIZE = 10;

/** Maximum characters of response text to include in LLM evaluation to manage token usage. */
const RESPONSE_TRUNCATION_LIMIT = 1500;

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
 * Evaluate evidence presence using LLM-as-judge with batching for efficiency.
 */
export async function batchEvaluateEvidence(inputs: EvidenceCheckInput[]) {
  const results = new Map<string, EvidenceCheckResult>();

  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const batch = inputs.slice(i, i + BATCH_SIZE);
    const batchResults = await evaluateBatch(batch);
    for (const result of batchResults) {
      results.set(result.caseId, result);
    }
  }

  return results;
}

/**
 * Evaluate a single batch of cases using the LLM judge.
 */
async function evaluateBatch(batch: EvidenceCheckInput[]) {
  if (batch.length === 0) {
    return [];
  }

  const casesDescription = batch
    .map(
      (c, idx) => `
### Case ${idx + 1}: ${c.caseId}
**Required Evidence Concepts:** ${c.requiredEvidence.join(", ")}

**Response to Evaluate:**
${c.responseText.slice(0, RESPONSE_TRUNCATION_LIMIT)}
`
    )
    .join("\n---\n");

  const prompt = `You are an eval judge for a Chrome Enterprise diagnostic AI. For each case below, determine if the response adequately addresses the required evidence concepts.

## Rules
- Concepts can be addressed through synonyms, paraphrasing, or semantic equivalence
- Error codes (e.g., "ERR_NAME_NOT_RESOLVED") must be cited exactly OR explained equivalently (e.g., "DNS resolution failed")
- Technical terms can be explained rather than quoted verbatim
- Be lenient on exact wording but strict on conceptual coverage
- A concept is MISSING only if the response never addresses that topic at all

## Examples

**Example 1 — PASS**
Required: ["enroll", "chrome://policy"]
Response: "The browser is not yet registered with your organization. Navigate to chrome://policy to verify that policies are being applied after enrollment completes."
Verdict: PASS — "enroll" addressed by "registered" and "enrollment"; "chrome://policy" cited directly.

**Example 2 — PASS**
Required: ["ERR_NAME_NOT_RESOLVED", "wifi"]
Response: "DNS resolution is failing for clients.google.com, which typically indicates a Wi-Fi connectivity or DNS configuration issue."
Verdict: PASS — error code explained as "DNS resolution failing"; "wifi" addressed as "Wi-Fi connectivity".

**Example 3 — FAIL**
Required: ["DPAPI", "Safe Storage", "reset"]
Response: "The browser profile appears corrupted. Try clearing the cache and restarting Chrome."
Verdict: FAIL — response never mentions DPAPI, Safe Storage, or credential reset. Generic advice without addressing the specific evidence concepts.

**Example 4 — PASS**
Required: ["incognito", "cookie"]
Response: "I've drafted policy changes to enable cookie encryption and disable Incognito mode for your fleet."
Verdict: PASS — both concepts directly addressed even though the response is action-oriented rather than diagnostic.

**Example 5 — FAIL**
Required: ["PERMISSION_DENIED", "scope"]
Response: "Your connector policies are configured correctly with DLP rules active across the fleet."
Verdict: FAIL — response discusses configuration but never addresses permission errors or scope issues.

## Cases to Evaluate

${casesDescription}

Evaluate each case and return structured results.`;

  try {
    const response = await generateText({
      model: google("gemini-2.0-flash-001"),
      output: Output.object({ schema: EvidenceResultSchema }),
      prompt,
    });

    return response.output?.results ?? [];
  } catch (error) {
    console.error("LLM judge batch evaluation failed:", error);
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
 * Evaluate a single case for convenience.
 */
export async function evaluateEvidence(input: EvidenceCheckInput) {
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
