# CEP eval case index

This directory contains one Markdown file per eval case. Each file uses the same
sections (Summary, Reproduction, Conversation, Expected result, Cleanup) so the
tests and documentation stay aligned.

## Case index

| ID     | Title                                     | Source                 | Test coverage           |
| ------ | ----------------------------------------- | ---------------------- | ----------------------- |
| EC-001 | Connector scope mis-targeted              | TEST_PLAN S01          | tests/e2e-evals.test.ts |
| EC-002 | Missing policyTargetKey                   | TEST_PLAN S02          | tests/e2e-evals.test.ts |
| EC-003 | Malformed resolve payload                 | TEST_PLAN S03          | tests/e2e-evals.test.ts |
| EC-004 | DLP rules absent                          | TEST_PLAN S04          | tests/e2e-evals.test.ts |
| EC-005 | DLP rule present but not firing           | TEST_PLAN S05          | tests/e2e-evals.test.ts |
| EC-006 | Event reporting off                       | TEST_PLAN S06          | tests/e2e-evals.test.ts |
| EC-007 | Safe Browsing disabled                    | TEST_PLAN S07          | tests/e2e-evals.test.ts |
| EC-008 | Bulk Data Connector disabled              | TEST_PLAN S08          | tests/e2e-evals.test.ts |
| EC-009 | Web Data Connector missing                | TEST_PLAN S09          | tests/e2e-evals.test.ts |
| EC-010 | File Transfer Connector missing           | TEST_PLAN S10          | tests/e2e-evals.test.ts |
| EC-011 | Print Connector mis-scoped                | TEST_PLAN S11          | tests/e2e-evals.test.ts |
| EC-012 | Mixed group vs OU precedence              | TEST_PLAN S12          | tests/e2e-evals.test.ts |
| EC-013 | Enrollment token wrong OU                 | TEST_PLAN S13          | tests/e2e-evals.test.ts |
| EC-014 | Enrollment permission denied              | TEST_PLAN S14          | tests/e2e-evals.test.ts |
| EC-015 | Propagation delay                         | TEST_PLAN S15          | tests/e2e-evals.test.ts |
| EC-016 | Bad schema ID                             | TEST_PLAN S16          | tests/e2e-evals.test.ts |
| EC-017 | Group targeting format                    | TEST_PLAN S17          | tests/e2e-evals.test.ts |
| EC-018 | Reference doc grounding                   | TEST_PLAN S18          | tests/e2e-evals.test.ts |
| EC-019 | Token expired                             | TEST_PLAN S19          | tests/e2e-evals.test.ts |
| EC-020 | Rate limit handling                       | TEST_PLAN S20          | tests/e2e-evals.test.ts |
| EC-021 | Outlook.com blocked                       | TEST_PLAN S21          | tests/e2e-evals.test.ts |
| EC-022 | Outlook.com still blocked after removal   | TEST_PLAN S22          | tests/e2e-evals.test.ts |
| EC-023 | Detector tuning                           | TEST_PLAN S23          | tests/e2e-evals.test.ts |
| EC-024 | Conflicting DLP vs connector              | TEST_PLAN S24          | tests/e2e-evals.test.ts |
| EC-025 | Multi-OU comparison                       | TEST_PLAN S25          | tests/e2e-evals.test.ts |
| EC-026 | Multi-turn connector scope confirmation   | TEST_PLAN S26          | tests/e2e-evals.test.ts |
| EC-027 | OS version mismatch in CAA                | EVAL_CASES Scenario 1  | Planned                 |
| EC-028 | Encryption status detection failure       | EVAL_CASES Scenario 2  | Planned                 |
| EC-029 | IP subnet or geo blocking                 | EVAL_CASES Scenario 3  | Planned                 |
| EC-030 | Split-brain profile context               | EVAL_CASES Scenario 4  | Planned                 |
| EC-031 | Corporate-owned vs BYOD classification    | EVAL_CASES Scenario 5  | Planned                 |
| EC-032 | Access level logic errors                 | EVAL_CASES Scenario 6  | Planned                 |
| EC-033 | Malware scanning timeouts for large files | EVAL_CASES Scenario 7  | Planned                 |
| EC-034 | Password-protected file blocked           | EVAL_CASES Scenario 8  | Planned                 |
| EC-035 | DLP false positives with snippets         | EVAL_CASES Scenario 9  | Planned                 |
| EC-036 | Printing restrictions block jobs          | EVAL_CASES Scenario 11 | Planned                 |
| EC-037 | Clipboard restrictions                    | EVAL_CASES Scenario 12 | Planned                 |
| EC-038 | Policy precedence conflicts               | EVAL_CASES Scenario 13 | Planned                 |
| EC-039 | OU inheritance override                   | EVAL_CASES Scenario 14 | Planned                 |
| EC-040 | Policy schema JSON errors                 | EVAL_CASES Scenario 15 | Planned                 |
| EC-041 | Recommended vs mandatory policies         | EVAL_CASES Scenario 16 | Planned                 |
| EC-042 | User affiliation and profile separation   | EVAL_CASES Scenario 17 | Planned                 |
| EC-043 | Force-install extension failures          | EVAL_CASES Scenario 18 | Planned                 |
| EC-044 | Permission increase blocking              | EVAL_CASES Scenario 19 | Planned                 |
| EC-045 | Malicious extension removal validation    | EVAL_CASES Scenario 21 | Planned                 |
| EC-046 | Enrollment token invalid or expired       | EVAL_CASES Scenario 23 | Planned                 |
| EC-047 | Stale device sync                         | EVAL_CASES Scenario 24 | Planned                 |
| EC-048 | User session revocation delay             | EVAL_CASES Scenario 25 | Planned                 |
| EC-049 | PAC file and proxy authentication         | EVAL_CASES Scenario 27 | Planned                 |
| EC-050 | SSL inspection conflicts                  | EVAL_CASES Scenario 28 | Planned                 |
