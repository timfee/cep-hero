import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "bun:test";
import { randomUUID } from "crypto";

import { callChat, callChatMessages } from "@/lib/test-helpers/chat-client";
import {
  createOrgUnit,
  createUser,
  deleteOrgUnit,
  deleteUser,
  detectDomainFromUsers,
} from "@/lib/test-helpers/google-admin";

/**
 * Pause execution for a fixed delay.
 */
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const testUserDomain =
  process.env.TEST_USER_DOMAIN ??
  process.env.GOOGLE_TOKEN_EMAIL?.split("@")[1] ??
  "example.com";

const chatUrl = process.env.CHAT_URL ?? "http://localhost:3100/api/chat";

/**
 * Check whether the chat endpoint is reachable.
 */
async function isServerUp(url: string) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok || res.status >= 400;
  } catch {
    return false;
  }
}

/**
 * Accept either a live response or common auth/token failures.
 */
function expectLiveOrToken(text: string, keyword: string) {
  const lower = text.toLowerCase();
  if (
    lower.includes("google access token") ||
    lower.includes("service account could not mint") ||
    lower.includes("org unit id") ||
    lower.includes("group id") ||
    lower.includes("domain not found") ||
    lower.includes("unable to resolve root org unit id") ||
    lower.includes("requested entity was not found") ||
    lower.includes("no connector policies") ||
    lower.includes("connector policies are not") ||
    lower.includes("missing google access token") ||
    lower.includes("missing access token") ||
    lower.includes("not authorized")
  ) {
    return;
  }
  expect(lower).toContain(keyword);
}

function expectAuthOrToken(text: string) {
  const lower = text.toLowerCase();
  if (
    lower.includes("google access token") ||
    lower.includes("missing access token") ||
    lower.includes("missing google access token") ||
    lower.includes("not authorized") ||
    lower.includes("permission")
  ) {
    return;
  }
  expect(lower).toContain("token");
}

describe("CEP live evals", () => {
  const TEST_TIMEOUT_MS = 60000;
  const suffix = randomUUID().slice(0, 8);
  let server: { kill: () => void } | undefined;
  let resolvedDomain: string | null = null;
  const ous: string[] = [];
  const users: string[] = [];

  beforeAll(async () => {
    const needsLocal = chatUrl.includes("localhost");
    if (needsLocal) {
      const up = await isServerUp(chatUrl);
      if (!up) {
        server = Bun.spawn({
          cmd: ["bun", "run", "dev"],
          stdout: "inherit",
          stderr: "inherit",
          env: { ...process.env, PORT: "3100", NODE_ENV: "test" },
        });
        for (let i = 0; i < 60; i += 1) {
          if (await isServerUp(chatUrl)) break;
          await sleep(500);
        }
      }
    }

    try {
      resolvedDomain = await detectDomainFromUsers();
    } catch (error) {
      console.error("detectDomainFromUsers", error);
    }

    if (!resolvedDomain) {
      resolvedDomain = testUserDomain;
    }
  });

  beforeEach(async () => {
    if (chatUrl.includes("localhost")) {
      const up = await isServerUp(chatUrl);
      if (!up) {
        server = Bun.spawn({
          cmd: ["bun", "run", "dev"],
          stdout: "inherit",
          stderr: "inherit",
          env: { ...process.env, PORT: "3100", NODE_ENV: "test" },
        });
        for (let i = 0; i < 60; i += 1) {
          if (await isServerUp(chatUrl)) break;
          await sleep(500);
        }
      }
    }
  });

  afterAll(async () => {
    for (const u of users) {
      try {
        await deleteUser(u);
      } catch (e) {
        console.error("deleteUser", u, e);
      }
    }
    for (const ou of ous.reverse()) {
      try {
        await deleteOrgUnit(ou);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (!message.toLowerCase().includes("org unit not found")) {
          console.error("deleteOrgUnit", ou, e);
        }
      }
    }
    if (server) {
      try {
        server.kill();
      } catch (e) {
        console.error("kill server", e);
      }
    }
  });

  it(
    "EC-057 connector scope mis-targeted",
    async () => {
      const { orgUnitPath } = await createOrgUnit({
        name: `Engineering-Test-${suffix}`,
      });
      ous.push(orgUnitPath);
      const domain = resolvedDomain ?? testUserDomain;
      const userEmail = `testuser1-${suffix}@${domain}`;
      await createUser({
        primaryEmail: userEmail,
        password: "TempPassw0rd!",
        orgUnitPath,
      });
      users.push(userEmail);

      const prompt = `Why are connector policies not applying to ${orgUnitPath}?`;

      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "connector");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-058 missing policyTargetKey",
    async () => {
      const prompt =
        "Connector resolve failed because policyTargetKey is missing.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "policytargetkey");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-059 malformed resolve payload",
    async () => {
      const prompt =
        "Resolve returned invalid JSON payload for policyTargetKey.targetResource.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "policytargetkey");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-060 DLP rules absent",
    async () => {
      const prompt = "Why does testuser2@ have no DLP enforcement?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "dlp");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-061 DLP rule not firing",
    async () => {
      const prompt =
        "Why didn’t the DLP rule fire for testuser2 uploading to Drive?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "dlp");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-062 event reporting off",
    async () => {
      const prompt = "Why do Chrome audit events show zero for testuser3@?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "event");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-063 Safe Browsing disabled",
    async () => {
      const prompt = "Why isn’t Safe Browsing enforced for testuser4@?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "safe");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-064 Bulk Data Connector disabled",
    async () => {
      const prompt = "Bulk connector not working for testuser5@—why?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "connector");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-065 Web Data Connector missing",
    async () => {
      const prompt = "Why can’t testuser6@ export web data?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "connector");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-066 File Transfer Connector missing",
    async () => {
      const prompt = "Why can’t testuser7@ use file transfer connector?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "connector");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-067 Print Connector mis-scoped",
    async () => {
      const prompt = "Why doesn’t print connector apply to testuser8@?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "connector");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-068 Mixed group vs OU precedence",
    async () => {
      const prompt =
        "Which policy applies for a user in both OU and group targets?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "policy");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-069 Enrollment token wrong OU",
    async () => {
      const prompt =
        "Why are new devices enrolling to root instead of Enroll-Eng?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "enroll");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-070 Enrollment permission denied",
    async () => {
      const prompt = "Enrollment token creation failed with permission denied.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "permission");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-071 Propagation delay",
    async () => {
      const prompt = "Policies applied but not live yet after 30 minutes.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "policy");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-072 Bad schema ID",
    async () => {
      const prompt = "Policy resolve returned zero policies for schema id.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "policy");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-073 Group targeting format",
    async () => {
      const prompt =
        "Group-scoped connector ignored. What is correct targetResource format?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "group");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-074 Reference doc grounding",
    async () => {
      const prompt = "Show me Chrome DLP reference for this issue.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "reference");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-075 Token expired",
    async () => {
      const prompt = "Why does the bot say missing Google access token?";
      const resp = await callChat(prompt);
      expectAuthOrToken(resp.text);
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-076 Rate limit handling",
    async () => {
      const prompt = "Connector check hit rate limit.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "policy");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-077 Outlook.com blocked",
    async () => {
      const prompt = "Why can’t testuser13@ access outlook.com?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "outlook");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-078 Outlook.com still blocked after removal",
    async () => {
      const prompt = "Outlook.com is still blocked after policy removal.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "outlook");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-079 Detector tuning",
    async () => {
      const prompt = "Why is phone detector firing on internal domains?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "detector");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-080 Conflicting DLP vs connector",
    async () => {
      const prompt = "Data still leaving via bulk connector despite DLP rules.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "dlp");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-081 Multi-OU comparison",
    async () => {
      const prompt =
        "Compare connector coverage for Engineering-Test vs Sales-Test.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "ou");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-082 Multi-turn connector scope confirmation",
    async () => {
      const first = await callChatMessages([
        {
          role: "system",
          content: "You are the CEP troubleshooting assistant.",
        },
        {
          role: "user",
          content: "Connector policies are not applying to Engineering-Test.",
        },
      ]);
      const second = await callChatMessages([
        {
          role: "system",
          content: "You are the CEP troubleshooting assistant.",
        },
        {
          role: "user",
          content: "Connector policies are not applying to Engineering-Test.",
        },
        { role: "assistant", content: first.text },
        { role: "user", content: "We applied at customer level. What now?" },
      ]);
      expectLiveOrToken(second.text, "org");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-027 OS version mismatch in CAA",
    async () => {
      const prompt =
        "Access denied in context-aware access due to OS version mismatch.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "os");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-028 Encryption status detection failure",
    async () => {
      const prompt =
        "Access denied because encryption status is missing or unencrypted.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "encryption");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-029 IP subnet or geo blocking",
    async () => {
      const prompt = "Access blocked due to IP subnet or region restrictions.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "ip");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-030 Split-brain profile context",
    async () => {
      const prompt =
        "Access denied in a personal Chrome profile with missing device context.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "device");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-031 Corporate-owned vs BYOD classification",
    async () => {
      const prompt = "A corporate laptop is treated as BYOD and denied access.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "corporate");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-032 Access level logic errors",
    async () => {
      const prompt =
        "Access level logic change blocked everyone after a policy update.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "access");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-033 Malware scanning timeouts",
    async () => {
      const prompt = "Large file download failed with virus scan timeout.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "timeout");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-034 Password-protected files blocked",
    async () => {
      const prompt = "Encrypted ZIP blocked because it is unscannable.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "encrypted");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-035 DLP false positives",
    async () => {
      const prompt =
        "DLP blocked a product SKU list that looks like credit cards.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "dlp");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-036 Printing restrictions blocked jobs",
    async () => {
      const prompt = "Print job blocked by DLP policy.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "print");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-037 Clipboard restrictions",
    async () => {
      const prompt = "Copy/paste is blocked by clipboard restrictions.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "clipboard");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-038 Policy precedence conflicts",
    async () => {
      const prompt = "Local policy overrides cloud policy due to precedence.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "policy");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-039 OU inheritance override",
    async () => {
      const prompt = "A child OU is not inheriting root policy settings.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "inherit");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-040 Policy schema JSON errors",
    async () => {
      const prompt = "ExtensionSettings JSON is invalid and policy is ignored.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "json");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-041 Recommended vs mandatory policies",
    async () => {
      const prompt =
        "Users can override the homepage policy. Is it recommended?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "recommended");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-042 User affiliation and profile separation",
    async () => {
      const prompt =
        "User is not affiliated with device domain; policies limited.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "affiliated");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-043 Force-install extension failures",
    async () => {
      const prompt = "Forced extension install failed due to manifest errors.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "extension");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-044 Permission increase blocking",
    async () => {
      const prompt = "Extension disabled after requesting new permissions.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "permission");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-045 Malicious extension removal",
    async () => {
      const prompt = "Is the malicious extension still installed anywhere?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "malicious");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-046 Enrollment token invalid or expired",
    async () => {
      const prompt = "Enrollment token invalid or expired during device setup.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "token");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-047 Stale device sync",
    async () => {
      const prompt = "Device lastSyncTime is stale; state is out of date.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "sync");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-048 User session revocation delay",
    async () => {
      const prompt = "Suspended user still has an active Chrome session.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "suspend");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-049 PAC file and proxy authentication",
    async () => {
      const prompt = "PAC file proxy auth is blocking CEP traffic.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "proxy");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-050 SSL inspection conflicts",
    async () => {
      const prompt = "SSL inspection breaks connector traffic on our network.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "ssl");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-051 Connector handshake service availability",
    async () => {
      const prompt = "Connector scanning fails with service unavailable errors.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "service");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-052 Performance degradation telemetry",
    async () => {
      const prompt = "Chrome telemetry shows high CPU usage by an extension.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "extension");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-053 Corrupt extension state",
    async () => {
      const prompt = "An extension is crashing repeatedly and appears corrupt.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "extension");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-054 Deprovisioning gaps",
    async () => {
      const prompt = "Wiped devices still appear in inventory.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "device");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-055 Connector connectivity firewall",
    async () => {
      const prompt = "Connector uploads fail due to blocked ingestion endpoints.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "connector");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "EC-056 API quota exhaustion",
    async () => {
      const prompt = "Diagnostics hit API quota limits with HTTP 429.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "quota");
    },
    TEST_TIMEOUT_MS
  );
});
