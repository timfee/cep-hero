# EC-029: IP subnet or geo blocking

## Summary

CAA denies access because the request IP or region is outside allowed ranges.

## Reproduction

1. Define access level with allowed IP ranges or regions.
2. Access from a non-matching IP or region.
3. Inspect access denied logs.

## Conversation

User: “Why is access blocked when using home Wi-Fi?”

## Expected result

- Diagnosis points to unmet ip_address or region attribute.
- Evidence includes the request IP and allowed subnets.
- Next steps advise VPN usage or updating access level ranges.

## Cleanup

- None.
