# Library Layer Notes

- Scope: shared utilities, auth, MCP tooling, and integrations.
- Prefer pure helpers and return structured errors over throwing.
- Use narrow, runtime-safe type guards instead of assertions.
- Keep logging structured and tagged; avoid secrets.
- `lib/test-helpers/chat-client.ts` may shortcut to eval test-mode responses when `EVAL_TEST_MODE=1` is enabled for eval runs; keep retry/timeout behavior intact.
