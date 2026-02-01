# EC-006: Event reporting off

## Summary

Audit events are missing because event reporting is disabled at the OU.

## Reproduction

1. Create OU `Events-Off` and a user.
2. Disable event reporting for the OU.
3. Ask why audit events are zero.

## Conversation

User: “Why do Chrome audit events show zero for testuser3@?”

## Expected result

- Diagnosis points to reporting policy disabled.
- Evidence cites resolved policy or missing event stream.
- Next steps instruct enabling event reporting.

## Cleanup

- Remove policy, delete user and OU.
