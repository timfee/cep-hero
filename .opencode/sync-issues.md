# Sync Issues (Unresolved Only)

## SYNC-1

- Severity: HIGH
- Files: tests/e2e-evals.test.ts ↔ app/api/chat/route.ts
- Problem: `bun test` fails in `tests/e2e-evals.test.ts` with a beforeEach/afterEach hook timeout in registry-driven evals; intermittent ECONNRESET seen when calling `http://localhost:3100/api/chat`.
- Fix: Investigate flaky server startup/connection handling in test harness; ensure server readiness or add retry/backoff for chat client before hooks time out.
- Status: pending

## SYNC-2

- Severity: HIGH
- Files: tests/e2e-evals.test.ts
- Problem: `bun test` fails with beforeEach/afterEach hook timeout in "CEP live evals (registry-driven)"; 1 failed, 5 passed.
- Fix: Investigate test setup/teardown timing or server readiness; reduce flakiness and ensure hooks complete under timeout.
- Status: pending

## SYNC-3

- Severity: HIGH
- Files: tests/evals/test-plan.test.ts ↔ app/api/chat/route.ts
- Problem: `bun test` failed with ECONNRESET calling `http://localhost:3100/api/chat` during `tests/evals/test-plan.test.ts`.
- Fix: Stabilize eval test harness startup/teardown and add retry/backoff or readiness checks for the chat client.
- Status: pending

## SYNC-5

- Severity: HIGH
- Files: app/api/chat/route.ts ↔ tests/evals/test-plan.test.ts
- Problem: `bun test` hit API quota errors (`cloudidentity.googleapis.com` 429) during `/api/chat` calls.
- Fix: Stub or mock quota-limited API calls in eval tests, or add rate limiting/backoff in test harness.
- Status: pending

## SYNC-6

- Severity: HIGH
- Files: tests/evals/diagnostics.test.ts ↔ lib/test-helpers/eval-server.ts
- Problem: `bun test` fails with "Cannot find module '@/lib/test-helpers/eval-server'" when loading diagnostics eval tests.
- Fix: Ensure `@/lib/test-helpers/eval-server` is added to the repo and resolvable, or update imports to the correct path.
- Status: pending
