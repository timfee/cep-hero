import { describe, it, expect, beforeAll, afterAll } from "bun:test";

import { callChat } from "@/lib/test-helpers/chat-client";
import {
  buildPromptMap,
  filterEvalCases,
  loadEvalRegistry,
} from "@/lib/test-helpers/eval-registry";
import {
  assertStructuredResponse,
  assertRequiredEvidence,
  buildEvalPrompt,
  createRunId,
  enforceRubric,
  scoreRubric,
  writeEvalReport,
} from "@/lib/test-helpers/eval-runner";
import {
  ensureEvalServer,
  releaseEvalServer,
} from "@/lib/test-helpers/eval-server";

const TEST_TIMEOUT_MS = 120000;
const isFakeChatEnabled =
  process.env.EVAL_FAKE_CHAT === "1" ||
  process.env.EVAL_FAKE_CHAT_FALLBACK === "1";
const casePauseOverride = process.env.EVAL_CASE_PAUSE_MS;
const CASE_PAUSE_MS = casePauseOverride
  ? Number.parseInt(casePauseOverride, 10)
  : isFakeChatEnabled
    ? 0
    : 250;
const chatUrl = process.env.CHAT_URL ?? "http://localhost:3100/api/chat";
const manageServer = process.env.EVAL_MANAGE_SERVER !== "0";
const runParallel = process.env.EVAL_SERIAL !== "1";

const registry = loadEvalRegistry();
const promptMap = buildPromptMap(registry);
const runId = createRunId();
const shouldRunTestPlan =
  !process.env.EVAL_CATEGORY ||
  (process.env.EVAL_CATEGORY ?? "").includes("test_plan");
const cases = shouldRunTestPlan
  ? filterEvalCases(registry.cases, {
      ids: process.env.EVAL_IDS,
      categories: "test_plan",
      tags: process.env.EVAL_TAGS,
      limit: process.env.EVAL_LIMIT,
    })
  : [];

describe("CEP evals: test plan", () => {
  beforeAll(async () => {
    if (cases.length === 0) {
      return;
    }
    if (manageServer) {
      await ensureEvalServer({ chatUrl, manageServer });
    }
  });

  afterAll(() => {
    if (cases.length === 0) {
      return;
    }
    if (manageServer) {
      releaseEvalServer();
    }
  });

  it(
    "registry is loaded",
    () => {
      expect(registry.cases.length).toBeGreaterThan(0);
    },
    TEST_TIMEOUT_MS
  );

  if (cases.length === 0) {
    it(
      "no test plan evals selected",
      () => {
        expect(cases.length).toBe(0);
      },
      TEST_TIMEOUT_MS
    );
    return;
  }

  it(
    "runs test plan cases",
    async () => {
      const failures: Array<{ id: string; message: string }> = [];
      const missingFixtures = cases.filter(
        (evalCase) => !evalCase.fixtures || evalCase.fixtures.length === 0
      );
      console.log(
        `[eval][test-plan] start cases=${cases.length} fixturesMissing=${missingFixtures.length}${missingFixtures.length > 0 ? ` ids=${missingFixtures.map((item) => item.id).join(",")}` : ""}`
      );
      async function runCase(evalCase: (typeof cases)[number]): Promise<void> {
        if (!runParallel && CASE_PAUSE_MS > 0) {
          await new Promise((resolve) => setTimeout(resolve, CASE_PAUSE_MS));
        }

        const basePrompt =
          promptMap.get(evalCase.id) ??
          `Help me troubleshoot: ${evalCase.title}`;
        const prompt = buildEvalPrompt(basePrompt, {
          fixtures: evalCase.fixtures,
          overrides: evalCase.overrides,
          caseId: evalCase.id,
        });
        const start = performance.now();
        let status: "pass" | "fail" = "pass";
        let failure: unknown = undefined;
        let responseText = "";
        let responseMetadata: unknown = undefined;
        let schemaMatched = false;
        let rubricScore: number | undefined;

        try {
          const resp = await callChat(prompt);
          responseText = resp.text;
          responseMetadata = resp.metadata;
          schemaMatched = assertStructuredResponse({
            text: resp.text,
            metadata: resp.metadata,
            expectedSchema: evalCase.expected_schema,
          });
          assertRequiredEvidence({
            text: resp.text,
            metadata: resp.metadata,
            requiredEvidence: evalCase.required_evidence,
          });
          if (evalCase.rubric) {
            rubricScore = scoreRubric({
              text: resp.text,
              metadata: resp.metadata,
              criteria: evalCase.rubric.criteria,
            });
            enforceRubric({
              score: rubricScore,
              minScore: evalCase.rubric.min_score,
            });
          }
        } catch (err) {
          status = "fail";
          failure = err;
        }

        const error =
          failure instanceof Error
            ? failure.message
            : failure
              ? String(failure)
              : undefined;

        await writeEvalReport({
          runId,
          caseId: evalCase.id,
          title: evalCase.title,
          category: evalCase.category,
          tags: evalCase.tags,
          sourceRefs: evalCase.source_refs,
          caseFile: evalCase.case_file,
          prompt,
          responseText,
          responseMetadata,
          expectedSchema: evalCase.expected_schema,
          schemaMatched,
          rubricScore,
          rubricCriteria: evalCase.rubric?.criteria,
          rubricMinScore: evalCase.rubric?.min_score,
          status,
          durationMs: Math.round(performance.now() - start),
          timestamp: new Date().toISOString(),
          error,
        });

        if (failure) {
          failures.push({
            id: evalCase.id,
            message: error ?? "Unknown error",
          });
        }

        console.log(
          `[eval][test-plan] done ${evalCase.id} status=${status} durationMs=${Math.round(performance.now() - start)} schemaMatched=${schemaMatched}`
        );
      }

      if (runParallel) {
        await Promise.allSettled(cases.map((evalCase) => runCase(evalCase)));
      } else {
        for (const evalCase of cases) {
          await runCase(evalCase);
        }
      }

      if (failures.length > 0) {
        const details = failures
          .map((failure) => `- ${failure.id}: ${failure.message}`)
          .join("\n");
        throw new Error(`Test plan eval failures:\n${details}`);
      }
    },
    TEST_TIMEOUT_MS
  );
});
