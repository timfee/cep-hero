# EC-031: Corporate-owned vs BYOD classification

## Summary

Device access is restricted because the device is misclassified as BYOD rather
than corporate-owned.

## Reproduction

1. Require corporate-owned devices in access levels.
2. Use a device whose serial is missing from inventory.
3. Observe access denial with is_corporate_device unmet.

## Conversation

User: “This is a company laptop. Why is it treated as BYOD?”

## Expected result

- Diagnosis references unmet_policy_attribute=is_corporate_device.
- Evidence shows device serial not present in inventory list.
- Next steps instruct adding serial to corporate inventory.

## Cleanup

- None.
