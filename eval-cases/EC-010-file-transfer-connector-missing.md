# EC-010: File Transfer Connector missing

## Summary

File transfer connector is disabled or unset at the OU level.

## Reproduction

1. Create OU `FT-Off` and a user.
2. Leave FileTransferConnectorEnabled unset or false.
3. Ask why file transfer connector is unavailable.

## Conversation

User: “Why can’t testuser7@ use file transfer connector?”

## Expected result

- Diagnosis identifies missing/disabled file transfer connector policy.
- Evidence references resolved policy state.
- Next steps advise enabling the connector at the OU.

## Cleanup

- Remove policy, delete user and OU.
