# CEP eval case index

This directory contains one Markdown file per eval case. Each file uses the same
sections (Summary, Reproduction, Conversation, Expected result, Cleanup) so the
tests and documentation stay aligned.

## Common Challenges (EC-001–EC-026)

| ID     | Title                                           | Source             | Test coverage |
| ------ | ----------------------------------------------- | ------------------ | ------------- |
| EC-001 | Network connectivity during enrollment          | CommonChallenge-1  | Planned       |
| EC-002 | Enrollment error codes                          | CommonChallenge-2  | Planned       |
| EC-003 | ChromeOS auto-update failures                   | CommonChallenge-3  | Planned       |
| EC-004 | Duplicate machine identifier after VM cloning   | CommonChallenge-4  | Planned       |
| EC-005 | Policies not applying (restart vs invalid JSON) | CommonChallenge-5  | Planned       |
| EC-006 | macOS policy sync issue                         | CommonChallenge-6  | Planned       |
| EC-007 | Browser crashes (“Aw, Snap”)                    | CommonChallenge-7  | Planned       |
| EC-008 | Browser performance (high CPU/slow tabs)        | CommonChallenge-8  | Planned       |
| EC-009 | Endpoint Verification sync (macOS Keychain)     | CommonChallenge-9  | Planned       |
| EC-010 | Endpoint Verification sync (Windows DPAPI)      | CommonChallenge-10 | Planned       |
| EC-011 | Endpoint Verification cannot recover key        | CommonChallenge-11 | Planned       |
| EC-012 | Endpoint Verification service worker bug        | CommonChallenge-12 | Planned       |
| EC-013 | Chromebook battery/power issues                 | CommonChallenge-13 | Planned       |
| EC-014 | Account conflict gtempaccount.com               | CommonChallenge-14 | Planned       |
| EC-015 | Shared drive move/playback issues               | CommonChallenge-15 | Planned       |
| EC-016 | Device lockout (previous owner)                 | CommonChallenge-16 | Planned       |
| EC-017 | Citrix SPA integration issues (overview)        | CommonChallenge-17 | Planned       |
| EC-018 | CEP enrollment/connectors not registering       | CommonChallenge-18 | Planned       |
| EC-019 | Capturing network logs                          | CommonChallenge-19 | Planned       |
| EC-020 | Remote log collection & support                 | CommonChallenge-20 | Planned       |
| EC-021 | Wi‑Fi deauth/association codes                  | CommonChallenge-21 | Planned       |
| EC-022 | Update scattering delays                        | CommonChallenge-22 | Planned       |
| EC-023 | Citrix SPA profile picker                       | CommonChallenge-23 | Planned       |
| EC-024 | Citrix SPA group membership sync                | CommonChallenge-24 | Planned       |
| EC-025 | Citrix SPA expired token proxy pop-up           | CommonChallenge-25 | Planned       |
| EC-026 | Citrix SPA service unavailable                  | CommonChallenge-26 | Planned       |

Fixtures exist only for EC-001/002/003 (net logs and update_engine samples). Add concise fixtures under `evals/fixtures/EC-###/` when you tighten a case.

## Architectural Diagnostics (EC-027–EC-056)

| ID     | Title                                      | Source        | Test coverage           |
| ------ | ------------------------------------------ | ------------- | ----------------------- |
| EC-027 | OS version mismatch in CAA                 | Diagnostic-1  | tests/e2e-evals.test.ts |
| EC-028 | Encryption status detection failure        | Diagnostic-2  | tests/e2e-evals.test.ts |
| EC-029 | IP subnet or geo blocking                  | Diagnostic-3  | tests/e2e-evals.test.ts |
| EC-030 | Split-brain profile context                | Diagnostic-4  | tests/e2e-evals.test.ts |
| EC-031 | Corporate-owned vs BYOD classification     | Diagnostic-5  | tests/e2e-evals.test.ts |
| EC-032 | Access level logic errors                  | Diagnostic-6  | tests/e2e-evals.test.ts |
| EC-033 | Malware scanning timeouts                  | Diagnostic-7  | tests/e2e-evals.test.ts |
| EC-034 | Password-protected files blocked           | Diagnostic-8  | tests/e2e-evals.test.ts |
| EC-035 | DLP false positives                        | Diagnostic-9  | tests/e2e-evals.test.ts |
| EC-036 | Printing restrictions block jobs           | Diagnostic-11 | tests/e2e-evals.test.ts |
| EC-037 | Clipboard restrictions                     | Diagnostic-12 | tests/e2e-evals.test.ts |
| EC-038 | Policy precedence conflicts                | Diagnostic-13 | tests/e2e-evals.test.ts |
| EC-039 | OU inheritance override                    | Diagnostic-14 | tests/e2e-evals.test.ts |
| EC-040 | Policy schema JSON errors                  | Diagnostic-15 | tests/e2e-evals.test.ts |
| EC-041 | Recommended vs mandatory policies          | Diagnostic-16 | tests/e2e-evals.test.ts |
| EC-042 | User affiliation & profile separation      | Diagnostic-17 | tests/e2e-evals.test.ts |
| EC-043 | Force-install extension failures           | Diagnostic-18 | tests/e2e-evals.test.ts |
| EC-044 | Permission increase blocking               | Diagnostic-19 | tests/e2e-evals.test.ts |
| EC-045 | Malicious extension removal                | Diagnostic-21 | tests/e2e-evals.test.ts |
| EC-046 | Enrollment token issues                    | Diagnostic-23 | tests/e2e-evals.test.ts |
| EC-047 | Stale device sync                          | Diagnostic-24 | tests/e2e-evals.test.ts |
| EC-048 | User session revocation delay              | Diagnostic-25 | tests/e2e-evals.test.ts |
| EC-049 | PAC file & proxy authentication            | Diagnostic-27 | tests/e2e-evals.test.ts |
| EC-050 | SSL inspection conflicts                   | Diagnostic-28 | tests/e2e-evals.test.ts |
| EC-051 | Connector handshake & service availability | Diagnostic-10 | tests/e2e-evals.test.ts |
| EC-052 | Performance degradation telemetry          | Diagnostic-20 | tests/e2e-evals.test.ts |
| EC-053 | Corrupt extension state                    | Diagnostic-22 | tests/e2e-evals.test.ts |
| EC-054 | Deprovisioning gaps                        | Diagnostic-26 | tests/e2e-evals.test.ts |
| EC-055 | Connector connectivity firewall            | Diagnostic-29 | tests/e2e-evals.test.ts |
| EC-056 | API quota exhaustion                       | Diagnostic-30 | tests/e2e-evals.test.ts |

## Test Plan (EC-057–EC-082)

| ID     | Title                                   | Source       | Test coverage           |
| ------ | --------------------------------------- | ------------ | ----------------------- |
| EC-057 | Connector scope mis-targeted            | TestPlan-S01 | tests/e2e-evals.test.ts |
| EC-058 | Missing policyTargetKey                 | TestPlan-S02 | tests/e2e-evals.test.ts |
| EC-059 | Malformed resolve payload               | TestPlan-S03 | tests/e2e-evals.test.ts |
| EC-060 | DLP rules absent                        | TestPlan-S04 | tests/e2e-evals.test.ts |
| EC-061 | DLP rule present but not firing         | TestPlan-S05 | tests/e2e-evals.test.ts |
| EC-062 | Event reporting off                     | TestPlan-S06 | tests/e2e-evals.test.ts |
| EC-063 | Safe Browsing disabled                  | TestPlan-S07 | tests/e2e-evals.test.ts |
| EC-064 | Bulk Data Connector disabled            | TestPlan-S08 | tests/e2e-evals.test.ts |
| EC-065 | Web Data Connector missing              | TestPlan-S09 | tests/e2e-evals.test.ts |
| EC-066 | File Transfer Connector missing         | TestPlan-S10 | tests/e2e-evals.test.ts |
| EC-067 | Print Connector mis-scoped              | TestPlan-S11 | tests/e2e-evals.test.ts |
| EC-068 | Mixed group vs OU precedence            | TestPlan-S12 | tests/e2e-evals.test.ts |
| EC-069 | Enrollment token wrong OU               | TestPlan-S13 | tests/e2e-evals.test.ts |
| EC-070 | Enrollment permission denied            | TestPlan-S14 | tests/e2e-evals.test.ts |
| EC-071 | Propagation delay                       | TestPlan-S15 | tests/e2e-evals.test.ts |
| EC-072 | Bad schema ID                           | TestPlan-S16 | tests/e2e-evals.test.ts |
| EC-073 | Group targeting format                  | TestPlan-S17 | tests/e2e-evals.test.ts |
| EC-074 | Reference doc grounding                 | TestPlan-S18 | tests/e2e-evals.test.ts |
| EC-075 | Token expired                           | TestPlan-S19 | tests/e2e-evals.test.ts |
| EC-076 | Rate limit handling                     | TestPlan-S20 | tests/e2e-evals.test.ts |
| EC-077 | Outlook.com blocked                     | TestPlan-S21 | tests/e2e-evals.test.ts |
| EC-078 | Outlook.com still blocked after removal | TestPlan-S22 | tests/e2e-evals.test.ts |
| EC-079 | Detector tuning                         | TestPlan-S23 | tests/e2e-evals.test.ts |
| EC-080 | Conflicting DLP vs connector            | TestPlan-S24 | tests/e2e-evals.test.ts |
| EC-081 | Multi-OU comparison                     | TestPlan-S25 | tests/e2e-evals.test.ts |
| EC-082 | Multi-turn connector scope confirmation | TestPlan-S26 | tests/e2e-evals.test.ts |
