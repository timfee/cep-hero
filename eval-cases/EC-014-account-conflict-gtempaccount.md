# EC-014: Account conflict gtempaccount.com guest session

## Summary
Users must start a guest session due to account rename conflict
(gtempaccount.com).

## Reproduction
1. Rename user to create a gtempaccount conflict.
2. Observe guest session requirement on sign-in.
3. Ask how to resolve the conflict.

## Conversation
User: “The device says start a Guest session to activate network.”

## Expected result
- Diagnosis explains gtempaccount conflict.
- Evidence references Directory/Device account state.
- Next steps instruct sign-in with gtempaccount, migrate data, remove conflict.

## Cleanup
- Remove conflicting account if created.
