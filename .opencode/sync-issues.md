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

## SYNC-4

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
- Files: lib/test-helpers/chat-client.ts ↔ app/api/chat/route.ts ↔ tests/evals/test-plan.test.ts
- Problem: `bun test` failed in `tests/evals/test-plan.test.ts` with HTTP 500 from `/api/chat` (expected < 500). Failure surfaced in `callChatMessages` during EC-071.
- Fix: Investigate `/api/chat` error path for test bypass; add readiness/retry or stub/mocks to avoid 500s in eval runs.
- Status: pending

## SYNC-7

- Severity: HIGH
- Files: tests/evals/test-plan.test.ts ↔ lib/test-helpers/eval-runner.ts
- Problem: `bun test` failed in `tests/evals/test-plan.test.ts` (EC-080) with expectStructuredText expecting >= 1 match but received 0.
- Fix: Inspect response shaping for EC-080 and adjust prompt assembly or expected schema/evidence to restore at least one required match.
- Status: pending

## SYNC-7

- Severity: MEDIUM
- Files: .next/lock
- Problem: `bun run build` failed: Unable to acquire lock at `.next/lock` (another build/dev process may be running or stale lock).
- Fix: Stop any running Next.js build/dev process and remove stale `.next/lock`, then re-run `bun run build`.
- Status: pending

## SYNC-8

- Severity: HIGH
- Files: tests
- Problem: `bun test` timed out after 180000 ms with no completion output.
- Fix: Investigate hanging test(s) or server readiness; re-run with targeted suites to isolate the blocker.
- Status: pending
