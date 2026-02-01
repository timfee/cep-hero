# EC-037: Clipboard restrictions

## Summary

Copy/paste is blocked for protected sources due to DLP clipboard policies.

## Reproduction

1. Configure clipboard restrictions for external destinations.
2. Attempt to copy from a protected app to a personal destination.
3. Observe CLIPBOARD_OPERATION_BLOCKED.

## Conversation

User: “Copy/paste stopped working between apps. Why?”

## Expected result

- Diagnosis references clipboard policy restrictions.
- Evidence includes clipboard_event or data_transfer_event.
- Next steps advise adjusting DLP clipboard policy.

## Cleanup

- None.
