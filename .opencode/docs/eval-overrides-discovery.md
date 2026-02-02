# Research: Eval base+delta overrides (local discovery)

Date: 2026-02-01
Source: Local repo files (no external docs)
Confidence: MEDIUM
Version: N/A (repo-local)

## Context

Goal: Document current eval prompt construction and registry override fields so base+delta overlays can be added without guessing.

## Findings

- buildEvalPrompt now appends base snapshot, registry overrides, and per-case overrides (if present) before fixtures when env flags are enabled. Base snapshot path: `evals/fixtures/base/api-base.json`. Overrides merge into the base JSON before formatting into the prompt. See `lib/test-helpers/eval-runner.ts` (buildEvalPrompt overloads, mergeJson, loadJsonFixture).
- Fixtures are appended by path, preserving filename labels. See `lib/test-helpers/eval-runner.ts` formatFixture usage.
- Registry cases allow an optional `overrides?: string[]` array field (parsed via `getOptionalStringArray`). This is now used at runtime by buildEvalPrompt.
- `evals/registry.json` includes overrides for EC-003 pointing to `evals/fixtures/EC-003/overrides.json`.
- Per-case override file example now exists at `evals/fixtures/EC-003/overrides.json`.

## Implications for base+delta overlays

- The prompt payload is string-based, but base snapshot and overrides are merged as JSON before formatting into the prompt.
- Overrides are expected to be JSON objects that deep-merge onto the base snapshot. When both values are objects, keys merge recursively; otherwise the override value replaces the base.
- Precedence: base snapshot → registry/per-case overrides (in order) → fixtures attached after the merged base block.

## Source locations

- `lib/test-helpers/eval-runner.ts`: buildEvalPrompt overloads, mergeJson, loadJsonFixture, formatFixture.
- `lib/test-helpers/eval-registry.ts`: `RegistryCase.overrides` and parse logic.
- `evals/registry.json`: overrides entry for EC-003 referencing `evals/fixtures/EC-003/overrides.json`.

## Open questions

- Should additional cases use per-case overrides or registry overrides arrays? Both paths are supported and merge in listed order.
