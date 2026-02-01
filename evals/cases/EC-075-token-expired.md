# EC-075: Token expired

## Summary

The assistant reports missing Google access token due to expired or revoked
credentials.

## Reproduction

1. Revoke or expire the access token used by chat.
2. Ask a policy or connector question.
3. Observe token error response.

## Conversation

User: “Why does the bot say missing Google access token?”

## Expected result

- Diagnosis identifies missing/expired token.
- Evidence points to auth failure.
- Next steps provide re-auth instructions.

## Cleanup

- Reissue a valid token for subsequent tests.
