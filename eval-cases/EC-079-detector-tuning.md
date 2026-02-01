# EC-079: Detector tuning

## Summary

A DLP detector fires on internal domains and needs tuning.

## Reproduction

1. Generate events with detector_name=PHONE for a user.
2. Ask why the detector fires on internal domains.

## Conversation

User: “Why is phone detector firing on internal domains?”

## Expected result

- Diagnosis references detector match details.
- Evidence includes detector_name and event metadata.
- Next steps suggest tuning or adding allowlist conditions.

## Cleanup

- Remove any test rules/users/OUs if created.
