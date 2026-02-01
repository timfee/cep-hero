# EC-003: ChromeOS auto-update failures

## Summary

Devices do not auto-update due to policy pinning or scattering delays.

## Reproduction

1. Set update policies (pinning or large scattering).
2. Review `update_engine.log` for errors.
3. Ask why devices are stuck on old versions.

## Conversation

User: “ChromeOS devices aren’t updating. What’s wrong?”

## Expected result

- Diagnosis points to update policy settings or connectivity.
- Evidence references `update_engine.log` or policy values.
- Next steps suggest disabling pinning or lowering scatter.

## Cleanup

- Restore update policies if modified.
