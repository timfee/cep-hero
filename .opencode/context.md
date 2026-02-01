# Project Context

## Environment

- Language: TypeScript
- Runtime: Bun + Node (Next.js 16.1.6)
- Build: `bun run build`
- Test: `bun test`
- Package Manager: Bun (bun.lock)

## Project Type

- Application (Next.js web app + MCP server)

## Infrastructure

- Container: None detected
- Orchestration: None detected
- CI/CD: Not detected in .github/workflows
- Cloud: Google Cloud APIs (Admin SDK, Chrome Management, Cloud Identity)

## Structure

- Source: `app/`, `lib/`
- Tests: `tests/`
- Docs: `README.md`, `TEST_PLAN.md`, `EVAL_CASES.md`, `evals/cases/`
- Entry: `app/api/chat/route.ts`

## Conventions

- Naming: camelCase for functions, kebab-case for filenames
- Imports: path alias `@/` used for internal modules
- Error handling: try/catch with error logging
- Testing: bun:test with describe/it

## Notes

- Ultracite is the lint/format tool (`bun x ultracite fix`).
- Live evals use `/api/chat` with test bypass when enabled.
- Eval overrides: JSON object overrides deep-merge onto `evals/fixtures/base/api-base.json` when `EVAL_USE_BASE=1`.
- Precedence: base snapshot → registry/per-case overrides (in order) → fixtures appended after the merged base block.
