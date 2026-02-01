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
