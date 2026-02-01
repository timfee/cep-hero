# Research: Eval base+delta overrides (local discovery)
Date: 2026-02-01
Source: Local repo files (no external docs)
Confidence: MEDIUM
Version: N/A (repo-local)

## Context
Goal: Document current eval prompt construction and registry override fields so base+delta overlays can be added without guessing.

## Findings
- buildEvalPrompt currently appends base snapshot and fixtures to prompt when env flags are enabled. The base snapshot is hardcoded to `evals/fixtures/base/api-base.json` and is formatted as a text block. See `lib/test-helpers/eval-runner.ts` at lines 42-83.
- Fixtures are appended by path, preserving filename labels. See `lib/test-helpers/eval-runner.ts` at lines 69-75.
- Registry cases already allow an optional `overrides?: string[]` array field. Parsing uses `getOptionalStringArray`, but there is no runtime use elsewhere. See `lib/test-helpers/eval-registry.ts` at lines 21-23 and 151-154.
- The registry entries do not currently include an `overrides` field in `evals/registry.json` (sample entries in file show `fixtures` but not `overrides`).
- No `evals/fixtures/**/overrides.json` files exist in the repository.

## Implications for base+delta overlays
- The current prompt path is string-based (plain blocks). Base snapshot and overrides are merged as JSON before formatting into the prompt.
- Overrides are expected to be JSON objects that deep-merge onto the base snapshot. When both values are objects, keys merge recursively; otherwise the override value replaces the base.
- Precedence: base snapshot → registry/per-case overrides (in order) → fixtures attached after the merged base block.

## Source locations
- `lib/test-helpers/eval-runner.ts`: buildEvalPrompt and fixture formatting (lines 42-88).
- `lib/test-helpers/eval-registry.ts`: `RegistryCase.overrides` and parse logic (lines 21-23, 151-154).
- `evals/registry.json`: no overrides entries present (file-level scan).

## Open questions
- Source of overrides: registry `overrides` list vs. per-case `evals/fixtures/EC-###/overrides.json` path. Both paths are supported in code, but no `overrides.json` files exist yet.
