# EC-047: Stale device sync

## Summary

Device state is stale, causing incorrect access or compliance decisions.

## Reproduction

1. Use a device with lastSyncTime older than 24 hours.
2. Observe policy or access mismatches.
3. Ask why the device is seen as offline or non-compliant.

## Conversation

User: “Why does the console show an old device state?”

## Expected result

- Diagnosis references lastSyncTime and stale telemetry.
- Evidence includes device lastSyncTime values.
- Next steps advise forcing Endpoint Verification sync.

## Cleanup

- None.
