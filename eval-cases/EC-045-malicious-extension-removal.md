# EC-045: Malicious extension removal validation

## Summary

A known-malicious extension must be removed across the fleet.

## Reproduction

1. Identify a malicious extension ID.
2. Add it to the blocklist.
3. Verify countInstalledApps reaches zero.

## Conversation

User: “Is the malicious extension still installed anywhere?”

## Expected result

- Diagnosis reports devices still affected (if any).
- Evidence uses countInstalledApps or inventory results.
- Next steps instruct blocklisting and re-checking.

## Cleanup

- None.
