# CEP eval cases

The eval cases are now maintained as one Markdown file per case in
`evals/cases/`. This keeps the scenario details, reproduction steps, and
conversation examples aligned with the test suite.

## Index

- `evals/cases/README.md` contains the full index of cases, sources, and coverage.
- `evals/README.md` explains eval vs test and gating controls.
- Each `evals/cases/EC-###-*.md` file documents a single eval case.

## Conventions

- Case IDs are stable (`EC-001` .. `EC-085`).
- Test coverage is noted in the index.
- Each case includes: Summary, Reproduction, Conversation, Expected result,
  Cleanup.

## Running evals

Start the server once (recommended for speed):

```bash
bun run dev
```

Then run evals:

```bash
# Run all evals
EVAL_USE_BASE=1 bun run evals

# Run all evals (server already running)
EVAL_USE_BASE=1 bun run evals:fast

# Run a single eval by ID
EVAL_IDS=EC-075 EVAL_USE_BASE=1 bun run evals

# Run by category
EVAL_CATEGORY=connector EVAL_USE_BASE=1 bun run evals
EVAL_CATEGORY=policy EVAL_USE_BASE=1 bun run evals

# Run by tags
EVAL_TAGS=dlp EVAL_USE_BASE=1 bun run evals

# Test mode (no AI calls)
EVAL_TEST_MODE=1 bun run evals
```
