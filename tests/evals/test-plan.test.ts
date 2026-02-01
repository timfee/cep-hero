import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from "bun:test";

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

const TEST_TIMEOUT_MS = 60000;
const chatUrl = process.env.CHAT_URL ?? "http://localhost:3100/api/chat";
const manageServer = process.env.EVAL_MANAGE_SERVER !== "0";

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
    await ensureEvalServer({ chatUrl, manageServer });
  });

  afterAll(() => {
    if (cases.length === 0) {
      return;
    }
    releaseEvalServer();
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

  it.each(cases)(
    "$id $title",
    async (evalCase) => {
      const basePrompt =
        promptMap.get(evalCase.id) ?? `Help me troubleshoot: ${evalCase.title}`;
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
        throw failure;
      }
    },
    TEST_TIMEOUT_MS
  );
});
