# EC-043: Force-install extension failures

## Summary

Force-installed extensions fail due to manifest or fetch errors.

## Reproduction

1. Force-install an extension.
2. Simulate CRX fetch or manifest failure.
3. Verify extension missing on devices.

## Conversation

User: “Why didn’t the forced extension install?”

## Expected result

- Diagnosis points to install failure and error code.
- Evidence includes audit log event or countInstalledApps result.
- Next steps suggest fixing manifest or network access.

## Cleanup

- None.
