# EC-060: DLP rules absent

## Summary

No DLP rules are assigned to the user or OU, so enforcement never triggers.

## Reproduction

1. Create OU `DLP-Test` and a test user.
2. Ensure no DLP rules are assigned to that OU.
3. Ask why enforcement is missing.

## Conversation

User: “Why does testuser2 have no DLP enforcement?”

## Expected result

- Diagnosis identifies missing DLP rules for the target OU.
- Evidence shows empty DLP rule list or no assignments.
- Next steps recommend creating/applying a DLP rule to the OU.

## Cleanup

- Delete user and OU.
