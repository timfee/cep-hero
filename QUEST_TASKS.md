# CEP-Hero Evaluation System: Quest Tasks

This document tracks progress on overhauling the CEP-Hero evaluation system. Each task includes clear instructions for completion. Progress is tracked with status markers.

**Status Legend:**

- `[ ]` Not started
- `[~]` In progress
- `[x]` Completed
- `[!]` Blocked (needs user input)

**Last Updated:** 2026-02-02

---

## Phase 1: Foundation and Documentation

### 1.1 Documentation Overhaul

- [x] Create QUEST_INSTRUCTIONS.md with comprehensive eval documentation
- [x] Create QUEST_TASKS.md for multi-session progress tracking
- [ ] Update main README.md with clear, concise evals section
- [ ] Remove or consolidate redundant documentation (EVAL_CASES.md, TEST_PLAN.md references)
- [ ] Update evals/README.md to be more actionable and less verbose

### 1.2 Structure Cleanup

- [ ] Evaluate reports directory VCS strategy (currently gitignored - confirm this is correct)
- [ ] Clean up test file duplication (diagnostics.test.ts, test-plan.test.ts, common-challenges.test.ts share 90% code)
- [ ] Consider consolidating to single test runner with category filtering
- [ ] Remove tests/AGENTS.md if redundant with root AGENTS.md

### 1.3 Category Reorganization

- [ ] Analyze current 85 cases and propose new taxonomy based on:
  - Failure mode (policy, connector, DLP, enrollment, network, etc.)
  - Complexity (single-turn, multi-turn)
  - Data requirements (fixture-only, live-data)
- [ ] Document proposed reorganization in this file
- [ ] Implement reorganization after user approval

---

## Phase 2: Eval Case Review

For each eval case, assess:

1. Does it represent an actual CEP admin problem?
2. Can we quickly get the user to relevant guidance?
3. Is the chat fluid, understandable, relevant, contextual, and correct?
4. Are fixtures in place and reflective of actual API responses?
5. Can we improve UI rendering based on fixture exploration?

### 2.1 Common Challenges (EC-001 to EC-026)

| Case   | Title                                  | Reviewed | Fixtures | Notes                       |
| ------ | -------------------------------------- | -------- | -------- | --------------------------- |
| EC-001 | Network connectivity during enrollment | [ ]      | Partial  | Uses EC-019/EC-021 fixtures |
| EC-002 | Enrollment error codes                 | [ ]      | Partial  | Uses EC-003 fixture         |
| EC-003 | ChromeOS auto-update failures          | [ ]      | Yes      | Has overrides.json          |
| EC-004 | Duplicate machine identifier           | [ ]      | No       | Needs fixtures              |
| EC-005 | Policies not applying (restart)        | [ ]      | No       | Needs fixtures              |
| EC-006 | macOS policy sync issue                | [ ]      | No       | Needs fixtures              |
| EC-007 | Browser crashes (Aw, Snap)             | [ ]      | No       | Needs fixtures              |
| EC-008 | Browser performance (high CPU)         | [ ]      | No       | Needs fixtures              |
| EC-009 | Endpoint Verification (macOS Keychain) | [ ]      | No       | Needs fixtures              |
| EC-010 | Endpoint Verification (Windows DPAPI)  | [ ]      | No       | Needs fixtures              |
| EC-011 | Endpoint Verification recover key      | [ ]      | No       | Needs fixtures              |
| EC-012 | Endpoint Verification service worker   | [ ]      | No       | Needs fixtures              |
| EC-013 | Chromebook battery/power               | [ ]      | No       | Needs fixtures              |
| EC-014 | Account conflict gtempaccount          | [ ]      | No       | Needs fixtures              |
| EC-015 | Shared drive move/playback             | [ ]      | No       | Needs fixtures              |
| EC-016 | Device lockout (previous owner)        | [ ]      | No       | Needs fixtures              |
| EC-017 | Citrix SPA integration                 | [ ]      | No       | Needs fixtures              |
| EC-018 | CEP enrollment/connectors              | [ ]      | No       | Needs fixtures              |
| EC-019 | Capturing network logs                 | [ ]      | Yes      | Has net.log                 |
| EC-020 | Remote log collection                  | [ ]      | No       | Needs fixtures              |
| EC-021 | Wi-Fi deauth reason codes              | [ ]      | Yes      | Has eventlog.txt            |
| EC-022 | Update scattering delays               | [ ]      | No       | Needs fixtures              |
| EC-023 | Citrix SPA profile picker              | [ ]      | No       | Needs fixtures              |
| EC-024 | Citrix SPA group sync                  | [ ]      | No       | Needs fixtures              |
| EC-025 | Citrix SPA expired token               | [ ]      | No       | Needs fixtures              |
| EC-026 | Citrix SPA service unavailable         | [ ]      | No       | Needs fixtures              |

### 2.2 Diagnostics (EC-027 to EC-056)

| Case   | Title                             | Reviewed | Fixtures | Notes          |
| ------ | --------------------------------- | -------- | -------- | -------------- |
| EC-027 | OS version mismatch in CAA        | [ ]      | No       | Needs fixtures |
| EC-028 | Encryption status detection       | [ ]      | No       | Needs fixtures |
| EC-029 | IP subnet or geo blocking         | [ ]      | No       | Needs fixtures |
| EC-030 | Split-brain profile context       | [ ]      | No       | Needs fixtures |
| EC-031 | Corporate-owned vs BYOD           | [ ]      | No       | Needs fixtures |
| EC-032 | Access level logic errors         | [ ]      | No       | Needs fixtures |
| EC-033 | Malware scanning timeouts         | [ ]      | No       | Needs fixtures |
| EC-034 | Password-protected files blocked  | [ ]      | No       | Needs fixtures |
| EC-035 | DLP false positives               | [ ]      | No       | Needs fixtures |
| EC-036 | Printing restrictions             | [ ]      | No       | Needs fixtures |
| EC-037 | Clipboard restrictions            | [ ]      | No       | Needs fixtures |
| EC-038 | Policy precedence conflicts       | [ ]      | No       | Needs fixtures |
| EC-039 | OU inheritance override           | [ ]      | No       | Needs fixtures |
| EC-040 | Policy schema JSON errors         | [ ]      | No       | Needs fixtures |
| EC-041 | Recommended vs mandatory          | [ ]      | No       | Needs fixtures |
| EC-042 | User affiliation & profile        | [ ]      | No       | Needs fixtures |
| EC-043 | Force-install extension failures  | [ ]      | No       | Needs fixtures |
| EC-044 | Permission increase blocking      | [ ]      | No       | Needs fixtures |
| EC-045 | Malicious extension removal       | [ ]      | No       | Needs fixtures |
| EC-046 | Enrollment token issues           | [ ]      | No       | Needs fixtures |
| EC-047 | Stale device sync                 | [ ]      | No       | Needs fixtures |
| EC-048 | User session revocation delay     | [ ]      | No       | Needs fixtures |
| EC-049 | PAC file & proxy auth             | [ ]      | No       | Needs fixtures |
| EC-050 | SSL inspection conflicts          | [ ]      | No       | Needs fixtures |
| EC-051 | Connector handshake               | [ ]      | No       | Needs fixtures |
| EC-052 | Performance degradation telemetry | [ ]      | No       | Needs fixtures |
| EC-053 | Corrupt extension state           | [ ]      | No       | Needs fixtures |
| EC-054 | Deprovisioning gaps               | [ ]      | No       | Needs fixtures |
| EC-055 | Connector connectivity firewall   | [ ]      | No       | Needs fixtures |
| EC-056 | API quota exhaustion              | [ ]      | No       | Needs fixtures |

### 2.3 Test Plan (EC-057 to EC-085)

| Case   | Title                               | Reviewed | Fixtures | Notes              |
| ------ | ----------------------------------- | -------- | -------- | ------------------ |
| EC-057 | Connector scope mis-targeted        | [ ]      | No       | Needs fixtures     |
| EC-058 | Missing policyTargetKey             | [ ]      | No       | Needs fixtures     |
| EC-059 | Malformed resolve payload           | [ ]      | No       | Needs fixtures     |
| EC-060 | DLP rules absent                    | [ ]      | No       | Needs fixtures     |
| EC-061 | DLP rule not firing                 | [ ]      | No       | Needs fixtures     |
| EC-062 | Event reporting off                 | [ ]      | No       | Needs fixtures     |
| EC-063 | Safe Browsing disabled              | [ ]      | No       | Needs fixtures     |
| EC-064 | Bulk Data Connector disabled        | [ ]      | No       | Needs fixtures     |
| EC-065 | Web Data Connector missing          | [ ]      | No       | Needs fixtures     |
| EC-066 | File Transfer Connector missing     | [ ]      | No       | Needs fixtures     |
| EC-067 | Print Connector mis-scoped          | [ ]      | No       | Needs fixtures     |
| EC-068 | Mixed group vs OU precedence        | [ ]      | No       | Needs fixtures     |
| EC-069 | Enrollment token wrong OU           | [ ]      | No       | Needs fixtures     |
| EC-070 | Enrollment permission denied        | [ ]      | No       | Needs fixtures     |
| EC-071 | Propagation delay                   | [ ]      | No       | Needs fixtures     |
| EC-072 | Bad schema ID                       | [ ]      | No       | Needs fixtures     |
| EC-073 | Group targeting format              | [ ]      | No       | Needs fixtures     |
| EC-074 | Reference doc grounding             | [ ]      | No       | Needs fixtures     |
| EC-075 | Token expired                       | [ ]      | No       | Needs fixtures     |
| EC-076 | Rate limit handling                 | [ ]      | No       | Needs fixtures     |
| EC-077 | Outlook.com blocked                 | [ ]      | No       | Needs fixtures     |
| EC-078 | Outlook still blocked after removal | [ ]      | No       | Needs fixtures     |
| EC-079 | Detector tuning                     | [ ]      | No       | Needs fixtures     |
| EC-080 | Conflicting DLP vs connector        | [ ]      | No       | Needs fixtures     |
| EC-081 | Multi-OU comparison                 | [ ]      | No       | Needs fixtures     |
| EC-082 | Multi-turn connector scope          | [ ]      | No       | Needs fixtures     |
| EC-083 | Check org units                     | [ ]      | No       | Needs fixtures     |
| EC-084 | DLP audit rule all traffic          | [ ]      | Yes      | Has overrides.json |
| EC-085 | Browser security cookie incognito   | [ ]      | Yes      | Has overrides.json |

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

### 3.4 Test Infrastructure

- [ ] Consolidate three test files into single parameterized runner
- [ ] Add better error reporting for failed evals
- [ ] Implement eval comparison (before/after changes)
- [ ] Add CI integration for eval runs

---

## Phase 4: Individual Eval Deep Dives

This phase involves running each eval, analyzing the results, and making targeted improvements. Each eval should be treated as an opportunity to:

1. See if the system gets the user towards resolution
2. Determine if we need more knowledge, better tools, or better system instructions
3. Generate fixtures and explore API contracts
4. Ensure dynamic reasoning with RAG or web search

### Template for Eval Deep Dive

When working on an individual eval, document findings here:

```
### EC-XXX: [Title]

**Run Date:** YYYY-MM-DD
**Status:** Pass/Fail/Partial

**Prompt Used:**
[The actual prompt]

**AI Response Summary:**
[Brief summary of what the AI said]

**Assessment:**
- [ ] Represents actual CEP admin problem
- [ ] Gets user to relevant guidance quickly
- [ ] Chat is fluid and understandable
- [ ] Response is correct and actionable
- [ ] Fixtures are adequate

**Issues Found:**
- [List any issues]

**Improvements Made:**
- [List any changes]

**Follow-up Needed:**
- [List any remaining work]
```

---

## Session Log

Track work completed in each session:

### Session 1: 2026-02-02

**Completed:**

- Created QUEST_INSTRUCTIONS.md with comprehensive documentation
- Created QUEST_TASKS.md for progress tracking
- Researched AI SDK patterns (workflows, loop control, building agents)
- Researched industry best practices for AI evals (Anthropic guide)

**Next Session Should:**

1. Update main README.md with clear evals section
2. Clean up redundant documentation
3. Begin reviewing individual eval cases starting with EC-001
4. Create fixtures for cases that need them

---

## Quick Reference: Running Evals

```bash
# Start server (keep running)
bun run dev

# Run all evals
EVAL_USE_BASE=1 EVAL_USE_FIXTURES=1 bun run evals:run:fast

# Run single eval
EVAL_IDS=EC-057 EVAL_USE_BASE=1 EVAL_USE_FIXTURES=1 bun run evals:run:by-id

# Run with strict checking
EVAL_USE_BASE=1 EVAL_USE_FIXTURES=1 EVAL_STRICT_EVIDENCE=1 bun run evals:run:fast

# Check credentials before capturing fixtures
bun run credentials:check

# Capture live fixtures
bun run fixtures:capture
```

---

## Notes and Decisions

Document important decisions and discoveries here:

### Reports Directory Strategy

The `evals/reports/` directory is gitignored, which is correct. Reports are generated per-run and should not be committed to VCS. They are useful for local debugging but would create noise in version control.

### Test vs Eval Distinction

Following Anthropic's guidance:

- **Tests** verify code correctness with deterministic outcomes
- **Evals** assess AI behavior quality along multiple dimensions

The current codebase conflates these somewhat. The `tests/` directory should contain unit tests for code, while `evals/` should contain AI behavioral evaluations.

### Category Reorganization Proposal

Current categories (common_challenges, diagnostics, test_plan) reflect document origins, not a useful taxonomy. Proposed new organization:

**By Failure Domain:**

- `policy`: Policy application, precedence, inheritance
- `connector`: Chrome connectors (bulk, web, file transfer, print)
- `dlp`: Data Loss Prevention rules and detection
- `enrollment`: Device/browser enrollment issues
- `network`: Connectivity, proxy, firewall issues
- `endpoint`: Endpoint Verification issues
- `extensions`: Extension management issues
- `performance`: Performance and telemetry issues

**By Complexity:**

- `single-turn`: Simple question/answer
- `multi-turn`: Requires follow-up conversation

This reorganization would make it easier to:

- Find related evals
- Identify coverage gaps
- Run targeted eval subsets
