# EC-004: Duplicate machine identifier after VM cloning

## Summary
Cloned VMs share the same machine ID, causing enrollment conflicts.

## Reproduction
1. Clone a VM without resetting machine ID.
2. Observe duplicate device IDs in management API.
3. Ask why policies conflict.

## Conversation
User: “Two VMs show the same device ID after cloning. Why?”

## Expected result
- Diagnosis identifies duplicate machine identifiers.
- Evidence includes duplicate IDs from browser/device inventory.
- Next steps recommend sysprep/resetting machine ID and re-enroll.

## Cleanup
- Remove duplicate entries if created.
