# Scripts Directory

See the root [AGENTS.md](../AGENTS.md) for project-wide coding standards.

## Scope

Indexing and codegen scripts.

## Guidelines

- Keep scripts deterministic and idempotent
- Do not hand-edit generated outputs; update the source script
- Log progress with concise, structured messages

## Helpcenter Indexing

- 429s usually mean stale headers or missing corp session
- Refresh headers from `support.google.com` and update `scripts/index-helpcenter.ts`
