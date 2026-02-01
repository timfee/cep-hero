# EC-002: Missing policyTargetKey

## Summary

The policy resolve call fails because the request omits `policyTargetKey`.

## Reproduction

1. Call policy resolve without `policyTargetKey`.
2. Capture the error response.
3. Ask how to fix the resolve request.

## Conversation

User: “Why is connector resolve failing with missing policyTargetKey?”

## Expected result

- Diagnosis identifies missing `policyTargetKey`.
- Evidence includes the expected request body format.
- Next steps show `policyTargetKey.targetResource=orgunits/<id>`.

## Cleanup

- None.
