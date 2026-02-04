# App Layer Notes

- Scope: Next.js App Router UI and API routes.
- Keep handlers self-contained and use runtime guards for request bodies.
- Use concise TSDoc for exported functions and non-obvious helpers.
- Preserve structured logging for the POC; do not log secrets.
- `/api/chat` supports `EVAL_TEST_MODE=1` to return a lightweight synthetic payload for evals; keep real-chat path the default and guard test-mode by headers/env only.
