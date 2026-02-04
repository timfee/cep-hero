# Scripts Layer Notes

- Scope: indexing and codegen scripts.
- Keep scripts deterministic and idempotent.
- Do not hand-edit generated outputs; update the source script instead.
- Log progress with concise, structured messages.

## Helpcenter Indexing Notes

- 429s usually mean stale headers or missing corp session.
- Refresh headers by loading support.google.com in a corp session and copying the request headers from a successful page load.
- Paste the headers into the `headers` constant in `scripts/index-helpcenter.ts`.
