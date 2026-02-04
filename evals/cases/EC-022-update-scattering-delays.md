# EC-022: Update scattering delays

## Summary

Update scattering delays cause devices to remain on older versions.

## Reproduction

1. Configure large scatter factor in policy.
2. Observe delayed updates across fleet.
3. Ask why updates are slow.

## Conversation

User: “Updates take weeks to roll out. Why?”

## Expected result

- Diagnosis points to scatter factor policy.
- Evidence includes scatter settings from policy.
- Next steps suggest lowering scatter days.

## Cleanup

- Restore policy if changed.
