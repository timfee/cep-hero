# EC-048: User session revocation delay

## Summary

Suspended users retain access until tokens expire or sessions are forced out.

## Reproduction

1. Suspend a user account.
2. Observe that the Chrome session remains active.
3. Ask why access persists.

## Conversation

User: “Why can a suspended user still access data?”

## Expected result

- Diagnosis explains token expiry and session caching.
- Evidence references user suspension and session timing.
- Next steps advise SignOutUser command to force logout.

## Cleanup

- None.
