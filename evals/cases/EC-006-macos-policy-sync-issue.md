# EC-006: macOS policy sync (machine-level vs user-level)

## Summary

macOS device shows “No machine level policy manager exists” due to missing
enrollment token or reliance on user-level policies.

## Reproduction

1. Omit enrollment token on macOS device.
2. Verify policies fail at machine level.
3. Ask why machine policies are missing.

## Conversation

User: “macOS says no machine policy manager. Why?”

## Expected result

- Diagnosis identifies missing enrollment token or MDM requirement.
- Evidence includes enrollment status and OU placement.
- Next steps instruct token deployment or MDM for machine policies.

## Cleanup

- None.
