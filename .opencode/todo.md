# Mission: Unify CEP agent pipeline, frontend chat state, and tool hardening

- [x] Mission complete

## Project Context

- Language: TypeScript (Bun + Next.js)
- Core paths: `app/`, `lib/`, `components/`

## G1: Discovery & Plan | status: completed

- [x] G1 complete

- [x] S1.1: Update .opencode/context.md with backend/frontend/tool notes from audit | priority: medium | id:S1.1
- [x] S1.2: Finalize execution plan in .opencode/todo.md (this file) | priority: medium | id:S1.2

## G2: Backend agent unification | status: completed | depends:G1

- [x] G2 complete

- [x] S2.1: Refactor app/api/chat/route.ts to streamText agent with CepToolExecutor tools; remove maybeHandleAction and manual streaming; keep eval test-mode path | priority: high | id:S2.1
- [x] S2.2: Remove hardcoded next-steps override; update system prompt to cover connector targeting/scopes guidance | priority: medium | id:S2.2
- [x] S2.3: Align/retire stream-diagnose.ts so agent logic lives in route.ts (no dead paths) | priority: medium | id:S2.3

## G3: Frontend chat context | status: completed | depends:G1

- [x] G3 complete

- [x] S3.1: Add ChatContext + provider exposing sendMessage/input/setInput | priority: high | id:S3.1
- [x] S3.2: Wrap app providers with ChatContext provider | priority: medium | id:S3.2
- [x] S3.3: Update ChatConsole to use ChatContext for state/actions (no document events) | priority: high | id:S3.3
- [x] S3.4: Update app/page quick actions to call context sendMessage directly; remove CustomEvent dispatch | priority: high | id:S3.4

## G4: Tooling hardening | status: completed | depends:G1

- [x] G4 complete

- [x] S4.1: Add normalizeResource utility (strip id:, collapse //) and apply across CepToolExecutor inputs | priority: medium | id:S4.1
- [x] S4.2: Fix connector target candidates to avoid double slashes; log actual targetResource in recordActivity/debug | priority: medium | id:S4.2
- [x] S4.3: Implement pagination for getChromeEvents (pageToken input, nextPageToken output); expose via tool schema | priority: high | id:S4.3
- [x] S4.4: Replace reflection helpers (getEnrollmentCreate/getPoliciesList/getOrgUnitsList) with typed client access for safety | priority: medium | id:S4.4

## G5: Verification | status: completed

- [x] G5 complete

- [x] S5.1: Run lsp_diagnostics({ file: "*" }) | priority: high | id:S5.1
- [x] S5.2: Run targeted tests or chat flow check as feasible; note any blockers | priority: medium | id:S5.2
