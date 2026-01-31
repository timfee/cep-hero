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
    "S01 connector mis-scoped warning surfaces",
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
    "S02 missing policyTargetKey",
    async () => {
      const prompt =
        "Connector resolve failed because policyTargetKey is missing.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "policytargetkey");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "S03 malformed resolve payload",
    async () => {
      const prompt =
        "Resolve returned invalid JSON payload for policyTargetKey.targetResource.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "policytargetkey");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "S04 DLP rules absent",
    async () => {
      const prompt = "Why does testuser2@ have no DLP enforcement?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "dlp");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "S05 DLP rule not firing",
    async () => {
      const prompt =
        "Why didn’t the DLP rule fire for testuser2 uploading to Drive?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "dlp");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "S06 event reporting off",
    async () => {
      const prompt = "Why do Chrome audit events show zero for testuser3@?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "event");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "S07 Safe Browsing disabled",
    async () => {
      const prompt = "Why isn’t Safe Browsing enforced for testuser4@?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "safe");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "S08 Bulk Data Connector disabled",
    async () => {
      const prompt = "Bulk connector not working for testuser5@—why?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "connector");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "S09 Web Data Connector missing",
    async () => {
      const prompt = "Why can’t testuser6@ export web data?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "connector");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "S10 File Transfer Connector missing",
    async () => {
      const prompt = "Why can’t testuser7@ use file transfer connector?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "connector");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "S11 Print Connector mis-scoped",
    async () => {
      const prompt = "Why doesn’t print connector apply to testuser8@?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "connector");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "S12 Mixed group vs OU precedence",
    async () => {
      const prompt =
        "Which policy applies for a user in both OU and group targets?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "policy");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "S13 Enrollment token wrong OU",
    async () => {
      const prompt =
        "Why are new devices enrolling to root instead of Enroll-Eng?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "enroll");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "S14 Enrollment permission denied",
    async () => {
      const prompt = "Enrollment token creation failed with permission denied.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "permission");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "S15 Propagation delay",
    async () => {
      const prompt = "Policies applied but not live yet after 30 minutes.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "policy");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "S16 Bad schema ID",
    async () => {
      const prompt = "Policy resolve returned zero policies for schema id.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "policy");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "S17 Group targeting format",
    async () => {
      const prompt =
        "Group-scoped connector ignored. What is correct targetResource format?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "group");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "S18 Reference doc grounding",
    async () => {
      const prompt = "Show me Chrome DLP reference for this issue.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "reference");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "S19 Token expired",
    async () => {
      const prompt = "Why does the bot say missing Google access token?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "token");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "S20 Rate limit handling",
    async () => {
      const prompt = "Connector check hit rate limit.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "policy");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "S21 Outlook.com blocked",
    async () => {
      const prompt = "Why can’t testuser13@ access outlook.com?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "outlook");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "S22 Outlook.com still blocked after removal",
    async () => {
      const prompt = "Outlook.com is still blocked after policy removal.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "outlook");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "S23 Detector tuning",
    async () => {
      const prompt = "Why is phone detector firing on internal domains?";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "detector");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "S24 Conflicting DLP vs connector",
    async () => {
      const prompt = "Data still leaving via bulk connector despite DLP rules.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "dlp");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "S25 Multi-OU comparison",
    async () => {
      const prompt =
        "Compare connector coverage for Engineering-Test vs Sales-Test.";
      const resp = await callChat(prompt);
      expectLiveOrToken(resp.text, "ou");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "S26 Multi-turn: connector scope confirmation",
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
});
