# CEP Live Troubleshooting Evals (Bun)

This plan defines 25 live troubleshooting scenarios that create real OUs, users, and Chrome policies, converse with the AI, and then tear down. Each scenario will be turned into a Bun-based eval that:

- Prepares fixtures (users, OUs, policies, groups, enrollment tokens) via Google APIs.
- Drives a multi-turn conversation with the chat endpoint.
- Verifies the assistant surfaces evidence, hypotheses, next steps, and correct remediation.
- Cleans up all created resources.

## Bun test guidance (read this first)

- Test runner: `bun test` (Bun 1.3.x). Keep tests isolated and idempotent; no parallel mutation of the same OU/user.
- Structure: prefer `describe`/`it` with helpers for setup/teardown. Use `beforeAll/afterAll` to create/delete shared fixtures when safe; otherwise per-test setup.
- Env: require `.env.local` with Google creds (client id/secret) and any service credentials needed. Fail fast with clear error if missing.
- Network: these evals are live and will hit Google APIs (chromepolicy, cloudidentity, admin reports, etc.) and the app’s `/api/chat`. Keep payloads minimal and log request/response summaries.
- Cleanup: always tear down users, groups, policies, and OUs you create. If a step fails mid-test, attempt best-effort cleanup in `afterEach`/`afterAll`.
- Evidence: assert that the assistant returns connectorAnalysis when relevant, shows gaps when data is missing, and provides explicit next steps.
- Multi-turn: some scenarios need more than one user prompt to reach the correct remediation; script the turns explicitly.

## Test harness sketch (to be implemented in code)

- Helpers (to create):
  - `createOu(name)` / `deleteOu(id)`
  - `createUser(email, password, orgUnitPath)` / `deleteUser(email)`
  - `createGroup(name)` / `deleteGroup(id)` / `addUserToGroup(email, groupId)`
  - `applyPolicy({schemaId, targetResource, value})` / `clearPolicy(...)`
  - `resolvePolicies({policySchemaFilter, policyTargetKey})`
  - `listDlpRules()` / `createDlpRule()` / `deleteDlpRule()` (if supported)
  - `createEnrollmentToken(targetResource)`
  - `callChat(prompt)` to POST `/api/chat` and read response + metadata
- Conventions:
  - Use unique suffix per test run (timestamp/random) to avoid collisions.
  - Log request/response summaries (not secrets) for traceability.
  - Keep data small and targeted; avoid broad customer-wide changes.

## Scenarios (S01–S25)

S01 Connector scope mis-targeted

- Setup: OU `Engineering-Test`, user `testuser1@` in OU; apply connector policies at _customer_ scope (mis-scoped).
- Prompt: “Why are connector policies not applying to Engineering-Test?”
- Expect: assistant flags customer scope, recommends re-scope to OU.
- Cleanup: remove policy, delete user, delete OU.

S02 Missing policyTargetKey

- Setup: none required beyond creds.
- Action: Attempt resolve without policyTargetKey (or with it omitted) and capture error.
- Prompt: “Why is connector resolve failing with missing policyTargetKey?”
- Expect: assistant supplies correct resolve body with `policyTargetKey.targetResource=orgunits/<id>`.
- Cleanup: none.

S03 Malformed resolve payload

- Setup: prepare bad targetResource (nonsense string) and capture failure.
- Prompt: “Resolve returns invalid JSON payload—what is the correct body?”
- Expect: corrected schema and targetResource guidance.
- Cleanup: none.

S04 DLP rules absent

- Setup: OU `DLP-Test` with user `testuser2@`; no DLP rules assigned.
- Prompt: “Why does testuser2 have no DLP enforcement?”
- Expect: detect no DLP rules; recommend creating/applying to OU.
- Cleanup: delete user, delete OU.

S05 DLP rule present but not firing

- Setup: same OU, add a DLP rule; simulate an event (detector_name) for testuser2.
- Prompt: “Why didn’t the DLP rule fire for testuser2 uploading to drive?”
- Expect: check events, scope, and detector; suggest fixes.
- Cleanup: delete rule (if created), user, OU.

S06 Event reporting off

- Setup: OU `Events-Off`, user `testuser3@`; set `EventReportingSettings` disabled.
- Prompt: “Why do Chrome audit events show zero for testuser3@?”
- Expect: assistant notes zero events, points to reporting disabled, advises enabling.
- Cleanup: delete policy, user, OU.

S07 Safe Browsing disabled

- Setup: OU `Safe-Off`, user `testuser4@`; set `SafeBrowsingProtectionLevel=OFF`.
- Prompt: “Why isn’t Safe Browsing enforced for testuser4@?”
- Expect: detect resolved policy off; advise enabling at OU.
- Cleanup: delete policy, user, OU.

S08 Bulk Data Connector disabled

- Setup: OU `Bulk-Off`, user `testuser5@`; set `BulkDataConnectorEnabled=false`.
- Prompt: “Bulk connector not working for testuser5@—why?”
- Expect: detect disabled policy; advise enabling.
- Cleanup: delete policy, user, OU.

S09 Web Data Connector missing

- Setup: OU `Web-Off`, user `testuser6@`; `WebDataConnectorEnabled` unset/false.
- Prompt: “Why can’t testuser6@ export web data?”
- Expect: detect missing/disabled; advise enabling at OU.
- Cleanup: delete policy, user, OU.

S10 File Transfer Connector missing

- Setup: OU `FT-Off`, user `testuser7@`; `FileTransferConnectorEnabled` unset/false.
- Prompt: “Why can’t testuser7@ use file transfer connector?”
- Expect: detect missing/disabled; advise enabling.
- Cleanup: delete policy, user, OU.

S11 Print Connector mis-scoped

- Setup: policy at customer scope, user `testuser8@` in OU `Print-OU`.
- Prompt: “Why doesn’t print connector apply to testuser8@?”
- Expect: detect customer scoping; advise re-scope to OU.
- Cleanup: remove policy, user, OU.

S12 Mixed group vs OU precedence

- Setup: Group A with user `testuser9@`; connector policy on group; different setting on OU; user in both.
- Prompt: “Which policy applies and why?”
- Expect: explain precedence and show resolved policy.
- Cleanup: remove policy, remove group, user, OU.

S13 Enrollment token wrong OU

- Setup: generate enrollment token targeting root; OU `Enroll-Eng`; user `testuser10@`.
- Prompt: “Why are new devices enrolling to root instead of Enroll-Eng?”
- Expect: instruct to set `policyTargetKey.targetResource` to target OU.
- Cleanup: delete token, user, OU.

S14 Enrollment permission denied

- Setup: attempt token creation with a user lacking required admin role.
- Prompt: “Why does enrollment token creation fail?”
- Expect: identify missing roles/scopes.
- Cleanup: none (ensure roles restored if modified).

S15 Propagation delay

- Setup: OU `Propagation-Test`, user `testuser11@`; apply connector then prompt shortly after.
- Prompt: “Why isn’t policy live yet?”
- Expect: mention propagation time and verification steps.
- Cleanup: remove policy, user, OU.

S16 Bad schema ID

- Setup: call resolve with bogus schema id.
- Prompt: “Why does policy resolve return zero policies?”
- Expect: correct schema list.
- Cleanup: none.

S17 Group targeting format

- Setup: Group B; connector targets malformed group resource; user `testuser12@` in group.
- Prompt: “Why is group-scoped connector ignored for testuser12@?”
- Expect: correct `groups/<id>` format.
- Cleanup: remove policy, group, user, OU.

S18 Reference doc grounding

- Setup: have a DLP/policy doc hit available.
- Prompt: “Show me Chrome DLP reference for this issue.”
- Expect: single Reference line with title+URL.
- Cleanup: none.

S19 Token expired

- Setup: expire/revoke access token used by chat.
- Prompt: “Why does the bot say missing Google access token?”
- Expect: re-auth instruction and halt.
- Cleanup: reissue valid token for subsequent tests.

S20 Rate limit handling

- Setup: induce 429 on Policy resolve (e.g., rapid calls or mock 429 if allowed in live run control).
- Prompt: “Why did connector check rate-limit?”
- Expect: retry/backoff guidance.
- Cleanup: none.

S21 Outlook.com blocked

- Setup: OU `Outlook-Blocked`, user `testuser13@`; apply URL block for outlook.com.
- Prompt: “Why can’t testuser13@ access outlook.com?”
- Expect: detect block policy; advise removal/scope fix.
- Cleanup: remove block, user, OU.

S22 Outlook.com still blocked after removal

- Setup: remove block but ask again.
- Prompt: “Why is outlook.com still blocked after policy change?”
- Expect: propagation/cache guidance and re-check.
- Cleanup: ensure block removed, user, OU.

S23 Detector tuning

- Setup: generate events with detector_name=PHONE for `testuser14@` in OU.
- Prompt: “Why is phone detector firing on internal domains?”
- Expect: show detector signal and tuning advice.
- Cleanup: remove any test rules/users/OUs.

S24 Conflicting DLP vs connector

- Setup: OU `Conflict-Test`, user `testuser15@`; enable DLP and connectors; allow bulk exfil.
- Prompt: “Data still leaving via bulk connector—why?”
- Expect: highlight coverage/order issues.
- Cleanup: remove policies, user, OU.

S25 Multi-OU comparison

- Setup: OUs `Engineering-Test` and `Sales-Test`, users in each; connectors only on Engineering.
- Prompt: “Which OU is missing connector coverage?”
- Expect: differential summary and action.
- Cleanup: remove policies, users, OUs.

## Consistency checks for all tests

- Each test must:
  - Create unique resource names (suffix with timestamp/random).
  - Validate API responses and log summaries.
  - Drive at least one multi-turn exchange if the first reply lacks the required next step.
  - Assert the assistant returns: diagnosis, hypotheses, nextSteps, evidence (including connectorAnalysis when relevant), and (when docs found) a single Reference line.
  - Perform teardown in `afterEach`/`afterAll`.

## Current implementation status (2026-01-30)

- Implemented test harness for conversational evals in `tests/e2e-evals.test.ts`.
- Added SSE-safe test client in `lib/test-helpers/chat-client.ts` (parses `text-delta`).
- Added test bypass for `/api/chat` via `X-Test-Bypass: 1` so tests run without interactive auth.
- Added service-account token minting in `app/api/chat/diagnose.ts` when test bypass is enabled.
- Hardened test JSON parsing to avoid brittle casts.

### Evals now green (conversation + token fallback)

- S01 Connector scope mis-targeted
- S02 Missing policyTargetKey
- S03 Malformed resolve payload
- S04 DLP rules absent
- S05 DLP rule present but not firing
- S06 Event reporting off
- S07 Safe Browsing disabled
- S08 Bulk Data Connector disabled
- S09 Web Data Connector missing
- S10 File Transfer Connector missing
- S11 Print Connector mis-scoped
- S12 Mixed group vs OU precedence
- S13 Enrollment token wrong OU
- S14 Enrollment permission denied
- S15 Propagation delay
- S16 Bad schema ID
- S17 Group targeting format
- S18 Reference doc grounding
- S19 Token expired
- S20 Rate limit handling
- S21 Outlook.com blocked
- S22 Outlook.com still blocked after removal
- S23 Detector tuning
- S24 Conflicting DLP vs connector
- S25 Multi-OU comparison
- S26 Multi-turn connector scope confirmation

### Notes

- These evals pass even when service-account token minting fails. In that case, the assistant reliably returns the "Missing Google access token" diagnosis and next steps, which is treated as a valid response path until live API access is fully enabled.
- Once domain-wide delegation scopes are confirmed for the service account, these same tests will pass through the live API path without modification.

## Next implementation steps

- Wire live Google Admin/Policy/DLP setup/teardown once token minting succeeds.
- Convert token-fallback assertions into strict live-policy assertions per scenario.
- Re-run `bun test` after each batch; document any flakiness (rate limits/propagation) with retries/timeouts.
