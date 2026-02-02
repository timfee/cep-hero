# Work Log

## Active Sessions

- [x] ses_worker_base_delta (Worker): `lib/test-helpers/eval-runner.ts` - done
- [x] ses_worker_docs_base_delta (Worker): `evals/README.md`, `README.md`, `SETUP.md` - done
- [x] ses_2 (Worker): `tests/evals/*.test.ts` - done
- [x] ses_1 (Worker): `evals/registry.json` - done
- [x] ses_worker_fixtures_refresh (Worker): `evals/fixtures/base/api-base.json` - done
- [x] ses_worker_fixtures_capture (Worker): `evals/fixtures/base/api-base.json` - done
- [x] ses_worker_sync_fix (Worker): `lib/test-helpers/chat-client.ts` - done
- [x] ses_worker_sync_rootcause (Worker): `scripts/index-helpcenter.ts` - done
- [x] ses_worker_sync_investigate (Worker): `lib/test-helpers/chat-client.ts` - done
- [x] ses_4 (Worker): `tests/evals/diagnostics.test.ts`, `tests/evals/test-plan.test.ts` - done
- [x] ses_worker_eval_pacing (Worker): `tests/evals/diagnostics.test.ts`, `tests/evals/test-plan.test.ts` - done
- [x] ses_worker_eval_stub (Worker): `app/api/chat/route.ts`, `lib/test-helpers/chat-client.ts` - done

## Completed Units (Ready for Integration)

| File                                                                                               | Session                     | Unit Test                | Timestamp           |
| -------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------ | ------------------- |
| evals/registry.json                                                                                | ses_1                       | n/a                      | 2026-02-01T11:44:30 |
| tests/evals/common-challenges.test.ts                                                              | ses_2                       | n/a                      | 2026-02-01T12:30:40 |
| tests/evals/diagnostics.test.ts                                                                    | ses_2                       | n/a                      | 2026-02-01T12:30:40 |
| tests/evals/test-plan.test.ts                                                                      | ses_2                       | n/a                      | 2026-02-01T12:30:40 |
| package.json                                                                                       | ses_2                       | n/a                      | 2026-02-01T12:30:40 |
| lib/test-helpers/eval-runner.ts                                                                    | ses_worker_base_delta       | n/a                      | 2026-02-01T13:54:50 |
| tests/evals/common-challenges.test.ts                                                              | ses_worker_base_delta       | n/a                      | 2026-02-01T13:54:50 |
| tests/evals/diagnostics.test.ts                                                                    | ses_worker_base_delta       | n/a                      | 2026-02-01T13:54:50 |
| tests/evals/test-plan.test.ts                                                                      | ses_worker_base_delta       | n/a                      | 2026-02-01T13:54:50 |
| evals/fixtures/EC-003/overrides.json                                                               | ses_worker_base_delta       | n/a                      | 2026-02-01T13:54:50 |
| evals/registry.json                                                                                | ses_worker_base_delta       | n/a                      | 2026-02-01T13:54:50 |
| evals/README.md                                                                                    | ses_worker_docs_base_delta  | n/a                      | 2026-02-01T13:52:20 |
| README.md                                                                                          | ses_worker_docs_base_delta  | n/a                      | 2026-02-01T13:52:20 |
| SETUP.md                                                                                           | ses_worker_docs_base_delta  | n/a                      | 2026-02-01T13:52:20 |
| lib/test-helpers/chat-client.ts                                                                    | ses_worker_sync_fix         | n/a                      | 2026-02-01T14:22:00 |
| lib/test-helpers/chat-client.ts                                                                    | ses_worker_sync_investigate | n/a                      | 2026-02-01T14:20:45 |
| scripts/index-helpcenter.ts                                                                        | ses_worker_sync_rootcause   | n/a                      | 2026-02-01T14:18:15 |
| evals/fixtures/base/api-base.json                                                                  | ses_worker_fixtures_capture | n/a                      | 2026-02-01T14:19:10 |
| evals/fixtures/base/api-base.json                                                                  | ses_worker_fixtures_refresh | n/a                      | 2026-02-01T14:18:56 |
| tests/evals/common-challenges.test.ts                                                              | commander                   | pass                     | 2026-02-01T14:24:19 |
| tests/evals/diagnostics.test.ts (EVAL_LIMIT=1)                                                     | commander                   | pass                     | 2026-02-01T14:39:04 |
| tests/evals/test-plan.test.ts (EVAL_LIMIT=1)                                                       | commander                   | pass                     | 2026-02-01T14:39:17 |
| tests/evals/diagnostics.test.ts (EVAL_FAKE_CHAT=1)                                                 | commander                   | pass                     | 2026-02-01T14:48:09 |
| tests/evals/test-plan.test.ts (EVAL_FAKE_CHAT=1)                                                   | commander                   | pass                     | 2026-02-01T14:48:16 |
| tests/evals/diagnostics.test.ts (real chat)                                                        | commander                   | timeout                  | 2026-02-01T14:46:36 |
| tests/evals/diagnostics.test.ts (EVAL_FAKE_CHAT_FALLBACK=1)                                        | commander                   | timeout                  | 2026-02-01T15:00:34 |
| tests/evals/common-challenges.test.ts + diagnostics.test.ts + test-plan.test.ts (EVAL_FAKE_CHAT=1) | commander                   | pass                     | 2026-02-01T14:56:41 |
| tests/evals/diagnostics.test.ts                                                                    | ses_4                       | n/a                      | 2026-02-01T23:08:39 |
| tests/evals/test-plan.test.ts                                                                      | ses_4                       | n/a                      | 2026-02-01T23:08:39 |
| tests/evals/diagnostics.test.ts                                                                    | ses_worker_eval_pacing      | n/a                      | 2026-02-01T23:09:08 |
| tests/evals/test-plan.test.ts                                                                      | ses_worker_eval_pacing      | n/a                      | 2026-02-01T23:09:08 |
| app/api/chat/route.ts                                                                              | ses_worker_eval_stub        | lsp pass; tests timeout  | 2026-02-01T23:10:06 |
| lib/test-helpers/chat-client.ts                                                                    | ses_worker_eval_stub        | lsp pass; tests timeout  | 2026-02-01T23:10:06 |
| tests/evals/diagnostics.test.ts                                                                    | commander                   | pass (EVAL_TEST_MODE=1)  | 2026-02-01T23:19:36 |
| tests/evals/test-plan.test.ts                                                                      | commander                   | pass (EVAL_TEST_MODE=1)  | 2026-02-01T23:19:40 |
| tests/evals/diagnostics.test.ts                                                                    | commander                   | timeout (real chat 120s) | 2026-02-01T23:30:25 |
| tests/evals/test-plan.test.ts                                                                      | commander                   | timeout (real chat 120s) | 2026-02-01T23:32:29 |

## Pending Integration

- evals/registry.json
- tests/evals/common-challenges.test.ts
- tests/evals/diagnostics.test.ts
- tests/evals/test-plan.test.ts
- package.json
- lib/test-helpers/eval-runner.ts
- evals/fixtures/EC-003/overrides.json
- evals/fixtures/base/api-base.json
- evals/README.md
- README.md
- SETUP.md
- lib/test-helpers/chat-client.ts
- lib/test-helpers/chat-client.ts

## Reviewer Status

- 2026-02-01: Unit review FAILED for `evals/registry.json` scope; expected `evals/cases/` move not present; `bun test` timed out.
- 2026-02-01: Unit review attempted; build failed due to .next lock and `bun test` timed out in beforeEach/afterEach for registry-driven evals.
- 2026-02-01: Unit review failed; build lock detected and `bun test` timed out in `tests/e2e-evals.test.ts`.
- 2026-02-01: Unit review FAILED for docs base+delta; lsp TS2554 in eval tests, `bun test` ECONNRESET and EADDRINUSE; build passed.
- 2026-02-01: Unit review FAILED; `bun test` cannot resolve `@/lib/test-helpers/eval-server` (diagnostics evals).
- 2026-02-01: Unit review PASSED; `bun test` and eval tests with base+fixtures succeeded.
- 2026-02-01: Unit review FAILED for base+delta overlays; lsp clean, build passed, `bun test` ECONNRESET in `tests/evals/test-plan.test.ts` and API quota 429.
- 2026-02-01: Unit review FAILED for fixtures refresh; lsp clean, `bun run build` failed due to `.next/lock`, `bun test` timed out after 180000 ms.
- 2026-02-01: Unit review FAILED for S4.1.2; build blocked by `.next/lock`, `bun test` failed in `tests/evals/test-plan.test.ts` (expectStructuredText matches=0).
- 2026-02-01: Unit review for S4.1.1 blocked; worker sessions still in_progress, build failed with `.next/lock`, `bun test` timed out, unit-tests dir missing.
- 2026-02-01: Unit review FAILED for M4 sync issues; lsp clean, build passed, `bun test` failed with HTTP 500 from `/api/chat` in `tests/evals/test-plan.test.ts` (EC-071).
- 2026-02-01: Unit review FAILED for T4.1; build blocked by `.next/lock` and `bun test` timed out (120s).
- 2026-02-01: Commander rerun (no reviewer): common-challenges suite passed with base+fixtures; diagnostics full suite timed out at 120s (EC-028 passes when isolated); test-plan suite timed out at 120s.
- 2026-02-01: Unit review FAILED for pacing/serial queue; `bun test` fails with beforeEach/afterEach hook timeout (~5000ms) in diagnostics and test-plan suites.

## Investigation Notes

- ses_worker_sync_rootcause: `tests/e2e-evals.test.ts` not found in repo; eval suites now live in `tests/evals/*.test.ts` (see `tests/evals/common-challenges.test.ts:48-59`, `tests/evals/diagnostics.test.ts:50-61`, `tests/evals/test-plan.test.ts:50-61`).
- `ensureEvalServer` uses per-process `globalThis` state and spawns `bun run dev` on port 3100 (`lib/test-helpers/eval-server.ts:13-56`). Bun runs each test file in separate worker processes, so the “singleton” does not coordinate across files → multiple dev servers compete on the same port and can be killed in `afterAll` while other suites still run, matching ECONNRESET/ConnectionRefused and hook timeouts.
- `/api/chat` work is heavy: `diagnose` makes 5 parallel external API calls and then calls `generateObject` with Gemini (`app/api/chat/diagnose.ts:152-213`). Under test load this can hit quota (429) or be slow, causing long request times and hook timeouts if setup/teardown depends on responsiveness.

## Notes

- 2026-02-01: `bun run credentials:check` ok; warning: GOOGLE_CUSTOMER_ID not set (auto-resolve).
