# Library Layer Notes

- Scope: shared utilities, auth, MCP tooling, and integrations.
- Prefer pure helpers and return structured errors over throwing.
- Use narrow, runtime-safe type guards instead of assertions.
- Keep logging structured and tagged; avoid secrets.
