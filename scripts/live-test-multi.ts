/**
 * Multi-turn live tests simulating real user flows.
 */
import { createChatStream } from "@/lib/chat/chat-service";
import {
  FixtureToolExecutor,
  loadFixtureData,
} from "@/lib/mcp/fixture-executor";

const executor = new FixtureToolExecutor(loadFixtureData({}));

interface TurnResult {
  toolCalls: string[];
  text: string;
  hasCitations: boolean;
  hasSourcesHeading: boolean;
  questionMarks: number;
}

type ChatMessage = { role: "user" | "assistant"; content: string };

async function chatTurn(
  messages: ChatMessage[],
  userMessage: string,
  label: string
): Promise<{ result: TurnResult; updatedMessages: ChatMessage[] }> {
  console.log("\n--- " + label + " ---");
  console.log("USER: " + JSON.stringify(userMessage));

  const updatedMessages: ChatMessage[] = [
    ...messages,
    { role: "user", content: userMessage },
  ];

  const response = await createChatStream({
    messages: updatedMessages,
    accessToken: "fake-token-for-fixture-mode",
    executor,
  });

  const body = await response.text();
  const toolCalls: string[] = [];
  let fullText = "";

  for (const line of body.split("\n")) {
    if (line.indexOf("data: ") !== 0) {
      continue;
    }
    try {
      const data = JSON.parse(line.slice(6));
      if (data.type === "tool-input-available" && data.toolName) {
        toolCalls.push(data.toolName);
      }
      if (data.type === "text-delta" && data.delta) {
        fullText += data.delta;
      }
    } catch {
      // skip
    }
  }

  const uniqueTools = [...new Set(toolCalls)];
  const hasCitations = fullText.includes("[") && fullText.includes("](http");
  const hasSourcesHeading = fullText.toLowerCase().includes("sources");
  const questionMarks = (fullText.match(/\?/g) || []).length;

  console.log("TOOLS: [" + uniqueTools.join(", ") + "]");
  console.log("RESPONSE: " + fullText.slice(0, 800));
  console.log(
    "CITATIONS: inline=" + hasCitations + " sources=" + hasSourcesHeading
  );
  console.log("QUESTIONS: " + questionMarks);

  return {
    result: {
      toolCalls: uniqueTools,
      text: fullText,
      hasCitations,
      hasSourcesHeading,
      questionMarks,
    },
    updatedMessages: [
      ...updatedMessages,
      { role: "assistant", content: fullText },
    ],
  };
}

async function main() {
  console.log("=".repeat(70));
  console.log("FLOW 1: DLP Rule Creation (full lifecycle)");
  console.log("=".repeat(70));

  let msgs: ChatMessage[] = [];
  const f1t1 = await chatTurn(
    msgs,
    "Create a DLP rule to audit all traffic",
    "Turn 1: Request DLP rule"
  );
  msgs = f1t1.updatedMessages;

  const f1t2 = await chatTurn(msgs, "Confirm", "Turn 2: Confirm");
  msgs = f1t2.updatedMessages;

  const calledDiagnostic =
    f1t1.result.toolCalls.includes("listDLPRules") ||
    f1t1.result.toolCalls.includes("listOrgUnits");
  const calledDraft = f1t1.result.toolCalls.includes("draftPolicyChange");
  const confirmedCreate = f1t2.result.toolCalls.includes("createDLPRule");
  const f1pass = calledDiagnostic && calledDraft && confirmedCreate;
  console.log(
    "\nFLOW 1 VERDICT: " +
      (f1pass ? "PASS" : "FAIL") +
      " (tools: " +
      f1t1.result.toolCalls.join(", ") +
      " -> " +
      f1t2.result.toolCalls.join(", ") +
      ")"
  );

  console.log("\n" + "=".repeat(70));
  console.log("FLOW 2: Enable event reporting (button click)");
  console.log("=".repeat(70));

  msgs = [];
  const f2t1 = await chatTurn(
    msgs,
    "Enable Chrome event reporting for my fleet",
    "Turn 1: Enable event reporting (imperative)"
  );
  msgs = f2t1.updatedMessages;

  const f2pass =
    f2t1.result.toolCalls.length > 0 && f2t1.result.questionMarks <= 1;
  console.log(
    "\nFLOW 2 VERDICT: " +
      (f2pass ? "PASS" : "FAIL") +
      " (tools: " +
      f2t1.result.toolCalls.join(", ") +
      ", questions: " +
      f2t1.result.questionMarks +
      ")"
  );

  console.log("\n" + "=".repeat(70));
  console.log("FLOW 3: Policy change with confirmation");
  console.log("=".repeat(70));

  msgs = [];
  const f3t1 = await chatTurn(
    msgs,
    "Disable incognito mode for my fleet",
    "Turn 1: Disable incognito"
  );
  msgs = f3t1.updatedMessages;

  const f3t2 = await chatTurn(msgs, "Confirm", "Turn 2: Confirm");
  msgs = f3t2.updatedMessages;

  const f3pass =
    f3t1.result.toolCalls.includes("draftPolicyChange") &&
    f3t2.result.toolCalls.includes("applyPolicyChange");
  console.log(
    "\nFLOW 3 VERDICT: " +
      (f3pass ? "PASS" : "FAIL") +
      " (tools: " +
      f3t1.result.toolCalls.join(", ") +
      " -> " +
      f3t2.result.toolCalls.join(", ") +
      ")"
  );

  console.log("\n" + "=".repeat(70));
  console.log("FLOW 4: Knowledge question (citations expected)");
  console.log("=".repeat(70));

  msgs = [];
  const f4t1 = await chatTurn(
    msgs,
    "How do I prevent screenshots in Chrome Enterprise?",
    "Turn 1: Screenshot prevention"
  );

  const f4pass = f4t1.result.hasCitations;
  console.log(
    "\nFLOW 4 VERDICT: " +
      (f4pass ? "PASS" : "FAIL") +
      " (citations: " +
      f4t1.result.hasCitations +
      ", tools: " +
      f4t1.result.toolCalls.join(", ") +
      ")"
  );

  console.log("\n" + "=".repeat(70));
  console.log("FLOW 5: Connector check (should use tools)");
  console.log("=".repeat(70));

  msgs = [];
  const f5t1 = await chatTurn(
    msgs,
    "Check if our Chrome connector reporting is properly configured",
    "Turn 1: Check connectors"
  );

  const f5pass = f5t1.result.toolCalls.includes(
    "getChromeConnectorConfiguration"
  );
  console.log(
    "\nFLOW 5 VERDICT: " +
      (f5pass ? "PASS" : "FAIL") +
      " (tools: " +
      f5t1.result.toolCalls.join(", ") +
      ")"
  );

  console.log("\n" + "=".repeat(70));
  console.log("FINAL VERDICT");
  console.log("=".repeat(70));
  const results = [
    { name: "DLP lifecycle", pass: f1pass },
    { name: "Event reporting", pass: f2pass },
    { name: "Policy + confirm", pass: f3pass },
    { name: "Knowledge citations", pass: f4pass },
    { name: "Connector check", pass: f5pass },
  ];
  for (const r of results) {
    console.log("  " + (r.pass ? "PASS" : "FAIL") + " " + r.name);
  }
  const passCount = results.filter((r) => r.pass).length;
  console.log("\n" + passCount + "/" + results.length + " flows passing");
}

main().catch(console.error);
