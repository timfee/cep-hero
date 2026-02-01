# EC-063: Safe Browsing disabled

## Summary

Safe Browsing is set to OFF in the OU policy.

## Reproduction

1. Create OU `Safe-Off` and user.
2. Set SafeBrowsingProtectionLevel=OFF for the OU.
3. Ask why Safe Browsing is not enforced.

## Conversation

User: “Why isn’t Safe Browsing enforced for testuser4@?”

## Expected result

- Diagnosis identifies resolved Safe Browsing policy is OFF.
- Evidence shows policy resolve values.
- Next steps recommend enabling the policy at the OU.

## Cleanup

- Remove policy, delete user and OU.
