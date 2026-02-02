# CEP-Hero Evaluation System: Quest Tasks

This document tracks progress on overhauling the CEP-Hero evaluation system. Progress is tracked with status markers.

**Status Legend:**

- `[ ]` Not started
- `[~]` In progress
- `[x]` Completed
- `[!]` Blocked (needs user input)

**Last Updated:** 2026-02-02

---

## Phase 1: Foundation and Infrastructure

### 1.1 Structural Changes

- [x] Create standalone eval runner in `evals/lib/` (no bun:test dependency)
- [x] Reorganize categories from document-based to failure-domain based
- [x] Update `registry.json` with new category structure (85 cases, 15 categories)
- [x] Remove old eval test files (`evals/*.test.ts`)
- [x] Remove old helper files (`lib/test-helpers/eval-runner.ts`, `lib/test-helpers/eval-registry.ts`)
- [x] Update `package.json` scripts for new eval runner
- [x] Move unit test to `tests/` directory
- [x] Remove obsolete `requires_live_data` field from registry

### 1.2 Documentation

- [x] Create QUEST_INSTRUCTIONS.md with comprehensive eval documentation
- [x] Create QUEST_TASKS.md for progress tracking
- [x] Update main README.md with clear evals section
- [x] Update evals/README.md to be more actionable
- [x] Research and document AI SDK loop control and workflow patterns

---

## Phase 2: Eval Case Review

For each eval case, assess:

1. Does it represent an actual CEP admin problem?
2. Can we quickly get the user to relevant guidance?
3. Is the chat fluid, understandable, relevant, contextual, and correct?
4. Are fixtures in place and reflective of actual API responses?
5. Can we improve UI rendering based on fixture exploration?

### auth (3 cases)

| Case   | Title                             | Reviewed | Fixtures | Notes |
| ------ | --------------------------------- | -------- | -------- | ----- |
| EC-014 | Account conflict gtempaccount.com | [ ]      | No       |       |
| EC-048 | User session revocation delay     | [ ]      | No       |       |
| EC-075 | Token expired                     | [ ]      | No       |       |

### browser (3 cases)

| Case   | Title                                    | Reviewed | Fixtures | Notes |
| ------ | ---------------------------------------- | -------- | -------- | ----- |
| EC-007 | Browser crashes (Aw, Snap)               | [ ]      | No       |       |
| EC-008 | Browser performance (high CPU/slow tabs) | [ ]      | No       |       |
| EC-023 | Citrix SPA profile picker                | [ ]      | No       |       |

### connector (8 cases)

| Case   | Title                                      | Reviewed | Fixtures | Notes |
| ------ | ------------------------------------------ | -------- | -------- | ----- |
| EC-051 | Connector handshake & service availability | [ ]      | No       |       |
| EC-057 | Connector scope mis-targeted               | [ ]      | No       |       |
| EC-064 | Bulk Data Connector disabled               | [ ]      | No       |       |
| EC-065 | Web Data Connector missing                 | [ ]      | No       |       |
| EC-066 | File Transfer Connector missing            | [ ]      | No       |       |
| EC-067 | Print Connector mis-scoped                 | [ ]      | No       |       |
| EC-080 | Conflicting DLP vs connector               | [ ]      | No       |       |
| EC-082 | Multi-turn connector scope confirmation    | [ ]      | No       |       |

### devices (6 cases)

| Case   | Title                                  | Reviewed | Fixtures | Notes |
| ------ | -------------------------------------- | -------- | -------- | ----- |
| EC-013 | Chromebook battery/power issues        | [ ]      | No       |       |
| EC-016 | Device lockout (previous owner)        | [ ]      | No       |       |
| EC-031 | Corporate-owned vs BYOD classification | [ ]      | No       |       |
| EC-047 | Stale device sync                      | [ ]      | No       |       |
| EC-054 | Deprovisioning gaps                    | [ ]      | No       |       |
| EC-083 | Check Org Units                        | [ ]      | No       |       |

### dlp (9 cases)

| Case   | Title                                | Reviewed | Fixtures | Notes |
| ------ | ------------------------------------ | -------- | -------- | ----- |
| EC-033 | Malware scanning timeouts            | [ ]      | No       |       |
| EC-034 | Password-protected files blocked     | [ ]      | No       |       |
| EC-035 | DLP false positives                  | [ ]      | No       |       |
| EC-036 | Printing restrictions block jobs     | [ ]      | No       |       |
| EC-037 | Clipboard restrictions               | [ ]      | No       |       |
| EC-060 | DLP rules absent                     | [ ]      | No       |       |
| EC-061 | DLP rule present but not firing      | [ ]      | No       |       |
| EC-079 | Detector tuning                      | [ ]      | No       |       |
| EC-084 | DLP audit rule setup for all traffic | [ ]      | Yes      |       |

### endpoint (4 cases)

| Case   | Title                                       | Reviewed | Fixtures | Notes |
| ------ | ------------------------------------------- | -------- | -------- | ----- |
| EC-009 | Endpoint Verification sync (macOS Keychain) | [ ]      | No       |       |
| EC-010 | Endpoint Verification sync (Windows DPAPI)  | [ ]      | No       |       |
| EC-011 | Endpoint Verification cannot recover key    | [ ]      | No       |       |
| EC-012 | Endpoint Verification service worker bug    | [ ]      | No       |       |

### enrollment (7 cases) ✅ FIXTURES COMPLETE

| Case   | Title                                         | Reviewed | Fixtures | Notes |
| ------ | --------------------------------------------- | -------- | -------- | ----- |
| EC-001 | Network connectivity during enrollment        | [x]      | Yes      | Created net-fail.log and eventlog-wifi-fail.txt with connection failures |
| EC-002 | Enrollment error codes                        | [x]      | Yes      | Uses EC-003/update_engine.log with 402 error. Good match. |
| EC-004 | Duplicate machine identifier after VM cloning | [x]      | Yes      | Added audit events showing duplicate DEVICE_ID and browsers array |
| EC-018 | CEP enrollment/connectors not registering     | [x]      | Yes      | Empty browsers/events list with valid token not applied |
| EC-046 | Enrollment token issues                       | [x]      | Yes      | enrollmentToken with status: "expired" |
| EC-069 | Enrollment token wrong OU                     | [x]      | Yes      | Token targeting customers/C00000000 instead of Enroll-Eng OU |
| EC-070 | Enrollment permission denied                  | [x]      | Yes      | errors.enrollBrowser: "PERMISSION_DENIED" |

### events (2 cases)

| Case   | Title                             | Reviewed | Fixtures | Notes |
| ------ | --------------------------------- | -------- | -------- | ----- |
| EC-052 | Performance degradation telemetry | [ ]      | No       |       |
| EC-062 | Event reporting off               | [ ]      | No       |       |

### extensions (4 cases)

| Case   | Title                            | Reviewed | Fixtures | Notes |
| ------ | -------------------------------- | -------- | -------- | ----- |
| EC-043 | Force-install extension failures | [ ]      | No       |       |
| EC-044 | Permission increase blocking     | [ ]      | No       |       |
| EC-045 | Malicious extension removal      | [ ]      | No       |       |
| EC-053 | Corrupt extension state          | [ ]      | No       |       |

### integration (4 cases)

| Case   | Title                                    | Reviewed | Fixtures | Notes |
| ------ | ---------------------------------------- | -------- | -------- | ----- |
| EC-017 | Citrix SPA integration issues (overview) | [ ]      | No       |       |
| EC-024 | Citrix SPA group membership sync         | [ ]      | No       |       |
| EC-025 | Citrix SPA expired token proxy pop-up    | [ ]      | No       |       |
| EC-026 | Citrix SPA service unavailable           | [ ]      | No       |       |

### network (6 cases)

| Case   | Title                           | Reviewed | Fixtures | Notes |
| ------ | ------------------------------- | -------- | -------- | ----- |
| EC-019 | Capturing network logs          | [ ]      | Yes      |       |
| EC-021 | Wi-Fi deauth/association codes  | [ ]      | Yes      |       |
| EC-029 | IP subnet or geo blocking       | [ ]      | No       |       |
| EC-049 | PAC file & proxy authentication | [ ]      | No       |       |
| EC-050 | SSL inspection conflicts        | [ ]      | No       |       |
| EC-055 | Connector connectivity firewall | [ ]      | No       |       |

### policy (15 cases)

| Case   | Title                                           | Reviewed | Fixtures | Notes |
| ------ | ----------------------------------------------- | -------- | -------- | ----- |
| EC-005 | Policies not applying (restart vs invalid JSON) | [ ]      | No       |       |
| EC-006 | macOS policy sync issue                         | [ ]      | No       |       |
| EC-022 | Update scattering delays                        | [ ]      | No       |       |
| EC-038 | Policy precedence conflicts                     | [ ]      | No       |       |
| EC-039 | OU inheritance override                         | [ ]      | No       |       |
| EC-040 | Policy schema JSON errors                       | [ ]      | No       |       |
| EC-041 | Recommended vs mandatory policies               | [ ]      | No       |       |
| EC-042 | User affiliation & profile separation           | [ ]      | No       |       |
| EC-058 | Missing policyTargetKey                         | [ ]      | No       |       |
| EC-059 | Malformed resolve payload                       | [ ]      | No       |       |
| EC-068 | Mixed group vs OU precedence                    | [ ]      | No       |       |
| EC-071 | Propagation delay                               | [ ]      | No       |       |
| EC-072 | Bad schema ID                                   | [ ]      | No       |       |
| EC-073 | Group targeting format                          | [ ]      | No       |       |
| EC-081 | Multi-OU comparison                             | [ ]      | No       |       |

### security (6 cases)

| Case   | Title                                                      | Reviewed | Fixtures | Notes |
| ------ | ---------------------------------------------------------- | -------- | -------- | ----- |
| EC-027 | OS version mismatch in CAA                                 | [ ]      | No       |       |
| EC-028 | Encryption status detection failure                        | [ ]      | No       |       |
| EC-030 | Split-brain profile context                                | [ ]      | No       |       |
| EC-032 | Access level logic errors                                  | [ ]      | No       |       |
| EC-063 | Safe Browsing disabled                                     | [ ]      | No       |       |
| EC-085 | Browser security - cookie encryption and disable incognito | [ ]      | Yes      |       |

### system (7 cases)

| Case   | Title                                   | Reviewed | Fixtures | Notes |
| ------ | --------------------------------------- | -------- | -------- | ----- |
| EC-015 | Shared drive move/playback issues       | [ ]      | No       |       |
| EC-020 | Remote log collection & support         | [ ]      | No       |       |
| EC-056 | API quota exhaustion                    | [ ]      | No       |       |
| EC-074 | Reference doc grounding                 | [ ]      | No       |       |
| EC-076 | Rate limit handling                     | [ ]      | No       |       |
| EC-077 | Outlook.com blocked                     | [ ]      | No       |       |
| EC-078 | Outlook.com still blocked after removal | [ ]      | No       |       |

### updates (1 case)

| Case   | Title                         | Reviewed | Fixtures | Notes |
| ------ | ----------------------------- | -------- | -------- | ----- |
| EC-003 | ChromeOS auto-update failures | [ ]      | Yes      |       |

---

## Phase 3: System Improvements

### 3.1 AI Agent Patterns

- [ ] Review current step count limits in chat API
- [ ] Implement dynamic loop control per AI SDK best practices
- [ ] Add evaluation/feedback loops for quality control
- [ ] Document when to use RAG vs web search vs follow-up questions

### 3.2 Fixture Infrastructure

- [ ] Create fixture generation script that captures live API responses
- [ ] Document fixture format and required fields
- [ ] Add validation for fixture completeness
- [ ] Create template fixtures for common scenarios

### 3.3 UI Rendering Improvements

- [ ] Review how DLP policies are displayed (currently shows "garbage policy IDs")
- [ ] Implement serialization of DLP rule properties for better display
- [ ] Improve structured data rendering in chat responses
- [ ] Document UI patterns for different data types

---

## Quick Reference: Running Evals

```bash
# Start server (keep running)
bun run dev

# Run all evals
EVAL_USE_BASE=1 bun run evals

# Run single eval by ID
EVAL_IDS=EC-057 EVAL_USE_BASE=1 bun run evals

# Run evals by category
EVAL_CATEGORY=connector EVAL_USE_BASE=1 bun run evals

# Run evals by tag
EVAL_TAGS=dlp EVAL_USE_BASE=1 bun run evals

# Run without server management (faster if server already running)
EVAL_USE_BASE=1 bun run evals:fast

# Run with verbose output
EVAL_USE_BASE=1 bun run evals:verbose
```

---

## Session Log

### Session 1: 2026-02-02

**Completed:**

- Created standalone eval runner in `evals/lib/` without bun:test dependency
- Reorganized 85 eval cases into 15 failure-domain categories
- Removed old eval test files and helper files
- Updated package.json scripts for new eval runner
- Created QUEST_INSTRUCTIONS.md and QUEST_TASKS.md
- Fixed missing EC-082 in registry
- Removed obsolete `requires_live_data` field from registry

**Next Session Should:**

1. Begin reviewing individual eval cases
2. Create fixtures for cases that need them
3. Update main README.md with clear evals section

### Session 2: 2026-02-02

**Completed:**

- Fixed line number reference in QUEST_INSTRUCTIONS.md to use search pattern instead
- Verified fixtures column accuracy in QUEST_TASKS.md (already correct)
- Confirmed main README.md already has comprehensive evals section
- Researched AI SDK documentation (loop-control, workflows, building-agents)
- Expanded QUEST_INSTRUCTIONS.md with detailed AI SDK patterns:
  - Content-based, tool-based, and budget-aware stopping conditions
  - prepareStep callback for dynamic execution
  - Five workflow patterns (Sequential, Routing, Parallel, Orchestrator-Worker, Evaluator-Optimizer)
  - Implementation recommendations for phased execution
- Improved evals/README.md with:
  - Decision tree for handling failed evals
  - Detailed "How to add a new eval" walkthrough
  - Iteration workflow section
  - Cross-references to QUEST files

**Key Insight:** Current `stepCountIs(5)` is too simplistic. Should implement semantic stopping conditions (e.g., stop when diagnosis is complete) rather than arbitrary step limits.

**Phase 2 Progress (same session):**

Reviewed and created fixtures for all 7 enrollment category cases:

| Case | Status | Fixture Created |
|------|--------|-----------------|
| EC-001 | ✅ Complete | Created net-fail.log with ERR_NAME_NOT_RESOLVED, ERR_CONNECTION_TIMED_OUT |
| EC-002 | ✅ Good | Already has 402 error in update_engine.log |
| EC-004 | ✅ Complete | Audit events + browsers array showing duplicate DEVICE_ID |
| EC-018 | ✅ Complete | Empty browsers/events with valid but unapplied token |
| EC-046 | ✅ Complete | enrollmentToken with status: "expired" |
| EC-069 | ✅ Complete | Token targeting root (customers/C00000000) instead of OU |
| EC-070 | ✅ Complete | errors.enrollBrowser: "PERMISSION_DENIED" |

**Infrastructure extended:**
- Added `enrollmentToken` and `browsers` fields to FixtureData type
- Extended fixture-executor to read enrollmentToken with status/error injection
- Extended loadFixtureData to handle new fields

**Eval run (test mode):** All 7 cases ran successfully (failures expected in test mode since synthetic responses don't contain evidence markers)

**Next Session Should:**

1. Run enrollment evals against live server to establish true baseline
2. Review and improve evals based on AI responses
3. Continue to next category (events - 2 cases)
