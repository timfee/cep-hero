# EC-015: Propagation delay

## Summary

Policies were updated recently and have not yet propagated to devices.

## Reproduction

1. Apply a policy update to an OU.
2. Ask for status shortly after the change.
3. Observe that devices still show old values.

## Conversation

User: “Policies applied but not live yet after 30 minutes.”

## Expected result

- Diagnosis cites propagation delay as the likely cause.
- Evidence references last update timestamps or device sync time.
- Next steps recommend waiting and verifying with resolve/policy reload.

## Cleanup

- Remove policy changes if needed.
