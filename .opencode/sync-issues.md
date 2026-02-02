# Sync Issues (Unresolved Only)

## SYNC-9
- Severity: HIGH
- Files: tests/evals/diagnostics.test.ts, tests/evals/test-plan.test.ts
- Problem: `bun test` fails with beforeEach/afterEach hook timeout (~5000ms) in diagnostics and test-plan suites.
- Fix: Ensure eval server readiness across suites (single shared server or longer hook timeout) and avoid teardown collisions; add explicit readiness/retry in harness.
- Status: pending

## SYNC-7
- Severity: HIGH
- Files: tests/evals/test-plan.test.ts ↔ lib/test-helpers/eval-runner.ts
- Problem: `bun test` failed in `tests/evals/test-plan.test.ts` (EC-080) with expectStructuredText expecting >= 1 match but received 0.
- Fix: Inspect response shaping for EC-080 and adjust prompt assembly or expected schema/evidence to restore at least one required match.
- Status: pending

## SYNC-10
- Severity: MEDIUM
- Files: .next/lock
- Problem: `bun run build` failed: Unable to acquire lock at `.next/lock` (another build/dev process may be running or stale lock).
- Fix: Stop any running Next.js build/dev process and remove stale `.next/lock`, then re-run `bun run build`.
- Status: resolved (no lock present; build passes)

## SYNC-11
- Severity: HIGH
- Files: components/ai-elements/chain-of-thought.tsx, components/ai-elements/tool.tsx, components/chat/index.ts
- Problem: `lsp_diagnostics` reports missing `motion`/`AnimatePresence` identifiers and missing `./chat-message` module.
- Fix: Restore framer-motion imports (or remove motion usage) and add/restore `components/chat/chat-message` module referenced by `components/chat/index.ts`.
- Status: resolved (imports restored; chat-message added; lsp clean)

## SYNC-12
- Severity: HIGH
- Files: app/api/chat/route.ts (imported as ../../app/api/chat/route.js)
- Problem: `bun run build` fails with TypeScript error: Cannot find module `../../app/api/chat/route.js` or its corresponding type declarations.
- Fix: Locate the file importing `../../app/api/chat/route.js` and update the path or add the missing module so the build can resolve it.
- Status: resolved (stream-diagnose now re-exports from route; TS path present)
