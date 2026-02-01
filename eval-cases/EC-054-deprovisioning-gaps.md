# EC-054: Deprovisioning gaps

## Summary
Old devices remain in inventory after being wiped or lost.

## Reproduction
1. Find devices with lastSyncTime > 90 days.
2. Ask why devices still appear in inventory.
3. Plan cleanup.

## Conversation
User: “Why are wiped devices still listed in the console?”

## Expected result
- Diagnosis points to stale inventory/deprovisioning gaps.
- Evidence includes lastSyncTime or device status.
- Next steps recommend deleting devices via API.

## Cleanup
- None.
