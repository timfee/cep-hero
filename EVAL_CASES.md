# CEP eval cases

The eval cases are now maintained as one Markdown file per case in
`eval-cases/`. This keeps the scenario details, reproduction steps, and
conversation examples aligned with the test suite.

## Index

- `eval-cases/README.md` contains the full index of cases, sources, and coverage.
- Each `eval-cases/EC-###-*.md` file documents a single eval case.

## Conventions

- Case IDs are stable (`EC-001` .. `EC-050`).
- Test coverage is noted in the index.
- Each case includes: Summary, Reproduction, Conversation, Expected result,
  Cleanup.
