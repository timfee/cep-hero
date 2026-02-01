# EC-061: DLP rule present but not firing

## Summary

The DLP rule exists but events are not matching the detector or scope.

## Reproduction

1. Create an OU and user, add a DLP rule.
2. Simulate an event that should match.
3. Ask why the rule did not fire.

## Conversation

User: “Why didn’t the DLP rule fire for testuser2 uploading to Drive?”

## Expected result

- Diagnosis checks event logs, detector name, and scope.
- Evidence references DLP events or missing detector matches.
- Next steps advise adjusting rule scope or detector settings.

## Cleanup

- Remove rule if created, delete user and OU.
