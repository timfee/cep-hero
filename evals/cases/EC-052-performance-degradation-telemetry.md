# EC-052: Performance degradation (telemetry)

## Summary

Performance issues are traced to specific extensions or tabs using telemetry.

## Reproduction

1. Pull telemetry for CPU/RAM usage by app ID.
2. Identify a high-usage extension.
3. Ask why performance is degraded.

## Conversation

User: “Chrome is slow. Which extension is causing high CPU?”

## Expected result

- Diagnosis identifies the offending extension or app.
- Evidence references telemetry metrics or app report.
- Next steps recommend disabling or replacing the extension.

## Cleanup

- None.
