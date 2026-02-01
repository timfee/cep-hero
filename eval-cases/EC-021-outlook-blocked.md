# EC-021: Outlook.com blocked

## Summary

URL blocking policies prevent access to outlook.com for a specific OU.

## Reproduction

1. Create OU `Outlook-Blocked` and a user.
2. Apply a URL block for outlook.com.
3. Ask why the site is blocked.

## Conversation

User: “Why can’t testuser13@ access outlook.com?”

## Expected result

- Diagnosis identifies URL block policy.
- Evidence references blocked URL policy and target OU.
- Next steps recommend removing or re-scoping the block.

## Cleanup

- Remove block, delete user and OU.
