# EC-046: Enrollment token invalid or expired

## Summary

Enrollment fails because the token is revoked or expired.

## Reproduction

1. Use an old or revoked enrollment token.
2. Attempt device enrollment.
3. Observe invalid token error.

## Conversation

User: “Enrollment says token invalid. What’s wrong?”

## Expected result

- Diagnosis identifies expired or revoked token status.
- Evidence includes enrollment token status or expiration time.
- Next steps recommend creating a new token.

## Cleanup

- None.
