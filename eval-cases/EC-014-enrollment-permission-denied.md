# EC-014: Enrollment permission denied

## Summary

Enrollment token creation fails because the requesting user lacks the required
admin roles or scopes.

## Reproduction

1. Attempt token creation with a user missing required roles.
2. Capture the permission denied error.
3. Ask why the request fails.

## Conversation

User: “Enrollment token creation failed with permission denied.”

## Expected result

- Diagnosis identifies missing roles or scopes.
- Evidence references permission error in the API response.
- Next steps list required admin roles/scopes.

## Cleanup

- None (restore roles if modified).
