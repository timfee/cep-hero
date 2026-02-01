# EC-030: Split-brain profile context

## Summary

Access is denied when the user uses a personal Chrome profile without managed
device telemetry.

## Reproduction

1. Sign in to Chrome with a personal profile on a managed device.
2. Attempt to access a protected resource.
3. Observe missing device_id in access logs.

## Conversation

User: “Why is access denied only in this Chrome profile?”

## Expected result

- Diagnosis identifies missing device telemetry for the profile.
- Evidence shows null or virtual device_id in audit logs.
- Next steps advise using the managed profile.

## Cleanup

- None.
