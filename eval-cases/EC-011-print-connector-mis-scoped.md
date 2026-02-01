# EC-011: Print Connector mis-scoped

## Summary

Print connector policies are applied at customer scope instead of the intended
OU, so the OU-specific settings never apply.

## Reproduction

1. Create OU `Print-OU` and a user.
2. Apply print connector policy at customer scope.
3. Ask why the print connector does not apply to the OU.

## Conversation

User: “Why doesn’t print connector apply to testuser8@?”

## Expected result

- Diagnosis flags mis-scoped policy at customer level.
- Evidence includes resolved policy targetResource `customers/...`.
- Next steps instruct re-scoping to OU or group.

## Cleanup

- Remove policy, delete user and OU.
