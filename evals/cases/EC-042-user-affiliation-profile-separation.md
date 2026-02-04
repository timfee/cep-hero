# EC-042: User affiliation and profile separation

## Summary

User policies do not apply at the machine level because the user is not
affiliated with the device’s enrollment domain.

## Reproduction

1. Sign in with a non-affiliated account on an enrolled device.
2. Attempt to enforce machine-level policies.
3. Check audit logs for is_affiliated=false.

## Conversation

User: “Why do policies only apply inside the browser?”

## Expected result

- Diagnosis references is_affiliated=false.
- Evidence uses login audit logs or device enrollment data.
- Next steps require matching user and device domains.

## Cleanup

- None.
