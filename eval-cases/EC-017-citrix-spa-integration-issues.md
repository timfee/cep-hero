# EC-017: Citrix Secure Private Access integration issues (overview)

## Summary
Citrix SPA integration fails due to session policy limits, provisioning errors,
or unsupported server-to-client configuration.

## Reproduction
1. Configure Citrix SPA with >8 groups or complex policy conditions.
2. Observe provisioning or session failures.
3. Ask why integration is unstable.

## Conversation
User: “Citrix SPA provisioning fails and sessions won’t load.”

## Expected result
- Diagnosis points to Citrix SPA limitations and policy constraints.
- Evidence references Citrix logs or group assignment counts.
- Next steps recommend splitting policies and reducing group scope.

## Cleanup
- None.
