# EC-024: Citrix SPA group membership not syncing

## Summary
Citrix SPA fails to apply policies because group membership isn’t synced.

## Reproduction
1. Set group permissions to restrict membership visibility.
2. Attempt Citrix SPA group-based policy.
3. Ask why group policies don’t apply.

## Conversation
User: “Citrix SPA isn’t picking up Google group membership.”

## Expected result
- Diagnosis points to Google Group visibility/permissions.
- Evidence references Directory API or group settings.
- Next steps advise updating group permissions.

## Cleanup
- None.
