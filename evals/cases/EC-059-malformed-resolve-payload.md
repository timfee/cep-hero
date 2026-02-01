# EC-059: Malformed resolve payload

## Summary

The resolve payload uses an invalid target resource string, causing a
malformed request.

## Reproduction

1. Use a malformed `policyTargetKey.targetResource` string.
2. Observe the resolve error.
3. Ask for the correct body.

## Conversation

User: “Resolve returns invalid JSON payload—what is the correct body?”

## Expected result

- Diagnosis points to invalid target resource format.
- Evidence includes the correct schema and target resource examples.
- Next steps provide a valid resolve body.

## Cleanup

- None.
