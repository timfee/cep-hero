# EC-053: Corrupt extension state

## Summary

An extension is stuck in a crash loop or corrupt state and cannot load.

## Reproduction

1. Trigger EXTENSION_CRASH events.
2. Observe “Repair” prompt in chrome://extensions.
3. Ask how to recover the extension.

## Conversation

User: “This extension keeps crashing and won’t load.”

## Expected result

- Diagnosis identifies corrupt extension state.
- Evidence references EXTENSION_CRASH events.
- Next steps recommend clearing profile data or reinstalling.

## Cleanup

- None.
