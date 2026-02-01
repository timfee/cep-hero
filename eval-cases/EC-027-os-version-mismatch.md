# EC-027: OS version mismatch in CAA

## Summary

Access is denied because the device OS version is below the policy minimum.

## Reproduction

1. Create a CAA access level with a minimum OS version.
2. Use a device reporting a lower OS build.
3. Review CAA access denied logs.

## Conversation

User: “Why is access denied for a device that just updated?”

## Expected result

- Diagnosis references unmet_policy_attribute=os_version.
- Evidence compares reported device OS version to policy requirement.
- Next steps advise updating OS or confirming device sync.

## Cleanup

- None.
