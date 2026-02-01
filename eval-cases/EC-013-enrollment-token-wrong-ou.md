# EC-013: Enrollment token wrong OU

## Summary

Enrollment tokens target the root OU, causing devices to enroll in the wrong OU.

## Reproduction

1. Create OU `Enroll-Eng`.
2. Generate an enrollment token targeting root.
3. Ask why devices enroll in root instead of the OU.

## Conversation

User: “Why are new devices enrolling to root instead of Enroll-Eng?”

## Expected result

- Diagnosis points to token targetResource set to root.
- Evidence includes enrollment token target details.
- Next steps instruct creating token with OU target.

## Cleanup

- Delete token, delete OU.
