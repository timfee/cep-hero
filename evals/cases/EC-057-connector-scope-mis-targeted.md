# EC-057: Connector scope mis-targeted

## Summary

Connector policies were applied at the customer level instead of the intended
OU, so the target OU does not receive the policy.

## Reproduction

1. Create OU `Engineering-Test`.
2. Create a test user in that OU.
3. Apply connector policies at the customer scope.
4. Ask why the OU is not receiving the policies.

## Conversation

User: “Why are connector policies not applying to Engineering-Test?”

## Expected result

- Diagnosis explains customer-level scope is overriding OU targeting.
- Evidence references policy resolve showing `customers/...` target.
- Next steps instruct re-scoping to the OU (or group).

## Cleanup

- Remove the policy, delete the user, delete the OU.
