# EC-028: Encryption status detection failure

## Summary

CAA denies access because encryption status is missing or reported as
unencrypted despite local encryption.

## Reproduction

1. Require encryption in an access level.
2. Use a device with encryption enabled but blocked telemetry.
3. Observe ACCESS_DENIED with encryption_status unmet.

## Conversation

User: “We have BitLocker on, why is access blocked?”

## Expected result

- Diagnosis references unmet_policy_attribute=encryption_status.
- Evidence shows device encryptionState or telemetry gaps.
- Next steps advise endpoint verification sync and permissions.

## Cleanup

- None.
