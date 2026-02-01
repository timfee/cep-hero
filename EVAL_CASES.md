# CEP eval cases

The eval cases are now maintained as one Markdown file per case in
`evals/cases/`. This keeps the scenario details, reproduction steps, and
conversation examples aligned with the test suite.

## Index

- `evals/cases/README.md` contains the full index of cases, sources, and coverage.
- `evals/README.md` explains eval vs test and gating controls.
- Each `evals/cases/EC-###-*.md` file documents a single eval case.

## Conventions

- Case IDs are stable (`EC-001` .. `EC-082`).
- Test coverage is noted in the index.
- Each case includes: Summary, Reproduction, Conversation, Expected result,
  Cleanup.

## Running evals

- Start the server once (recommended for speed):
  - `bun run dev`
- Then run evals without server management:
  - `bun run test:evals:fast`
- Or run a single group without server management:
  - `bun run test:evals:diag:fast`
- Enable fixtures for deterministic log-driven cases:
  - `EVAL_USE_FIXTURES=1 bun run test:evals:common:fast`
- Enforce strict evidence checks (optional):
  - `EVAL_STRICT_EVIDENCE=1 bun run test:evals:diag:fast`
- Enforce rubric scoring (optional):
  - `EVAL_RUBRIC_STRICT=1 bun run test:evals:diag:fast`
- Use fixtures + strict evidence together:
  - `EVAL_USE_FIXTURES=1 EVAL_STRICT_EVIDENCE=1 bun run test:evals:common:fast`
- Warning-only gates (optional):
  - `EVAL_WARN_MISSING_EVIDENCE=1 bun run test:evals:diag:fast`
  - `EVAL_WARN_RUBRIC=1 bun run test:evals:diag:fast`

- Run a single eval by ID:
  - `EVAL_IDS=EC-075 bun run test:eval-id`
- Run only Test Plan evals:
  - `bun run test:evals:plan`
- Run only Diagnostics evals:
  - `bun run test:evals:diag`
- Run only Common Challenges evals:
  - `bun run test:evals:common`
- Run by tags (comma-separated):
  - `EVAL_TAGS=dlp,connectors bun run test:evals:tags`
- Limit the number of cases:
  - `EVAL_LIMIT=5 bun run test:evals:diag`
