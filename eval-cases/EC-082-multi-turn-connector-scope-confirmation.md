# EC-082: Multi-turn connector scope confirmation

## Summary

The assistant should ask follow-ups and provide guidance after confirmation that
policies were applied at customer scope.

## Reproduction

1. Ask about connector policies not applying.
2. Confirm they are applied at customer level.
3. Verify the assistant recommends OU re-scope.

## Conversation

User: “Connector policies are not applying to Engineering-Test.”
User: “We applied at customer level. What now?”

## Expected result

- Diagnosis confirms customer-level scope is the cause.
- Evidence references policy targets.
- Next steps instruct OU or group scoping.

## Cleanup

- None.
