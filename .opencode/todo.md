# Mission: CEP eval base+delta overrides rollout

## Project Context

- Language: TypeScript (Bun + Next.js)
- Core paths: `lib/`, `tests/`, `evals/`

## File Manifest

| Action | File Path                             | Description                                                          | Dependencies                                                     |
| ------ | ------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| MODIFY | lib/test-helpers/eval-runner.ts       | Extend buildEvalPrompt to merge base snapshot + overrides + fixtures | lib/test-helpers/eval-registry.ts (RegistryCase overrides field) |
| MODIFY | tests/evals/common-challenges.test.ts | Pass overrides/caseId into buildEvalPrompt                           | lib/test-helpers/eval-runner.ts                                  |
| MODIFY | tests/evals/diagnostics.test.ts       | Pass overrides/caseId into buildEvalPrompt                           | lib/test-helpers/eval-runner.ts                                  |
| MODIFY | tests/evals/test-plan.test.ts         | Pass overrides/caseId into buildEvalPrompt                           | lib/test-helpers/eval-runner.ts                                  |

## G1: Discovery + Design | status: completed

### P1.1: Override schema decision | agent:Planner

- [x] T1.1.1: Decide overrides JSON shape and merge strategy | size:S
- [x] T1.1.2: Specify precedence order (base vs overrides vs fixtures) | size:S

## G2: Implementation | status: completed | depends:G1

### P2.1: Prompt assembly | agent:Worker

- [x] T2.1.1: MODIFY `lib/test-helpers/eval-runner.ts` | file:lib/test-helpers/eval-runner.ts | size:M

### P2.2: Test wiring | agent:Worker | depends:P2.1

- [x] T2.2.1: MODIFY `tests/evals/common-challenges.test.ts` | file:tests/evals/common-challenges.test.ts | size:S
- [x] T2.2.2: MODIFY `tests/evals/diagnostics.test.ts` | file:tests/evals/diagnostics.test.ts | size:S
- [x] T2.2.3: MODIFY `tests/evals/test-plan.test.ts` | file:tests/evals/test-plan.test.ts | size:S

## G3: Verification | status: in_progress | depends:G2

### P3.1: LSP + tests | agent:Reviewer

- [x] T3.1.1: Run `lsp_diagnostics({ file: "*" })` | size:S
- [x] T3.1.2: Run eval tests as needed (full suites) | size:S (passed with EVAL_FAKE_CHAT=1; real-chat runs tracked in SYNC-6)

## G4: Documentation | status: completed

### P4.1: Doc review | agent:Reviewer

- [x] T4.1.1: Review evals/README.md, README.md, SETUP.md updates for consistency | size:S
