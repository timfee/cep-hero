# EC-068: Mixed group vs OU precedence

## Summary

A user is targeted by both group and OU policies, requiring precedence
resolution to determine the effective setting.

## Reproduction

1. Create an OU and a group.
2. Add a user to the group and OU.
3. Apply conflicting connector settings to group and OU.
4. Ask which policy applies and why.

## Conversation

User: “Which policy applies for a user in both OU and group targets?”

## Expected result

- Diagnosis explains precedence rules and shows resolved policy.
- Evidence includes resolve response with sourceKey and target.
- Next steps clarify how to change precedence.

## Cleanup

- Remove policy, remove group, delete user and OU.
