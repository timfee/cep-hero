# EC-084: DLP audit rule setup for all traffic

## Summary

Administrator wants to create a DLP audit rule that monitors all traffic for sensitive data patterns. The system should guide them through the configuration process and provide actionable next steps.

## Reproduction

1. User asks to set up DLP monitoring for all traffic.
2. System should fetch current DLP rules and connector configuration.
3. System should propose a policy change using draftPolicyChange tool.
4. System should provide Admin Console deep link for manual configuration.

## Conversation

User: "I want to set up DLP to audit all traffic for sensitive data. How do I create a rule that monitors everything?"

## Expected result

- Diagnosis explains DLP audit rule capabilities and current state.
- Evidence references current DLP rules (or lack thereof) from listDLPRules.
- System calls draftPolicyChange to propose the audit rule configuration.
- Next steps include Admin Console link to DLP settings (https://admin.google.com/ac/chrome/dlp).
- Response explains what data types can be monitored (SSN, credit cards, etc.).

## Cleanup

- None.
