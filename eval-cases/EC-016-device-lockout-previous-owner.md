# EC-016: Device lockout (“locked by previous owner”)

## Summary
Device enrollment is blocked because the device is locked by a previous owner.

## Reproduction
1. Use a device previously enrolled in another domain.
2. Observe lockout screen.
3. Ask how to resolve the lockout.

## Conversation
User: “The device says it’s locked by previous owner.”

## Expected result
- Diagnosis identifies ownership lockout.
- Evidence references device ownership info in API.
- Next steps advise waiting 48 hours or powerwash.

## Cleanup
- None.
