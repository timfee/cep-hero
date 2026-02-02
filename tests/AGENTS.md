# Tests Layer Notes

- Scope: Bun-based unit and live eval tests.
- Keep tests isolated; prefer helpers in `lib/test-helpers`.
- Use explicit assertions and clear failure messages.
- Avoid type assertions; add minimal runtime parsing where needed.
- Eval runs log progress with `[eval]` prefix; keep logging structured and brief.
- Fixture coverage is sparse (EC-001/002/003). If a case needs evidence, add fixtures under `evals/fixtures/EC-###/` and wire them in `registry.json`.
- Use `EVAL_TEST_MODE=1` when you need fast/quota-safe runs; real chat remains default for integration.
