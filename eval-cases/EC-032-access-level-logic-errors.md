# EC-032: Access level logic errors

## Summary

Access levels contain logical errors (impossible AND conditions) that block all
users.

## Reproduction

1. Create an access level with contradictory logic.
2. Observe a spike in ACCESS_DENIED events.
3. Ask why all users are blocked.

## Conversation

User: “After the policy change, everyone is blocked. Why?”

## Expected result

- Diagnosis identifies logical contradictions in access level rules.
- Evidence cites access level definition or CEL expression.
- Next steps advise correcting logic (AND vs OR) and re-testing.

## Cleanup

- Revert access level changes.
