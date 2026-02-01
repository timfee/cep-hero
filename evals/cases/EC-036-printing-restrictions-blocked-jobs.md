# EC-036: Printing restrictions block jobs

## Summary

Print jobs are blocked by DLP policies targeting sensitive content.

## Reproduction

1. Enable DLP print restrictions.
2. Attempt to print content matching a rule.
3. Observe PRINT_JOB_BLOCKED events.

## Conversation

User: “Why is printing this document blocked?”

## Expected result

- Diagnosis cites DLP print rule and print_job_event.
- Evidence includes printer name and rule trigger.
- Next steps suggest refining the print rule or allowlisting printers.

## Cleanup

- None.
