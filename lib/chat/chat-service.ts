import { google } from "@ai-sdk/google";
import {
  generateText,
  hasToolCall,
  Output,
  stepCountIs,
  streamText,
  tool,
} from "ai";
import { z } from "zod";

import {
  ApplyPolicyChangeSchema,
  CepToolExecutor,
  CreateDLPRuleSchema,
  DraftPolicyChangeSchema,
  EnrollBrowserSchema,
  GetChromeEventsSchema,
  GetConnectorConfigSchema,
  GetFleetOverviewSchema,
  ListDLPRulesSchema,
  ListOrgUnitsSchema,
} from "@/lib/mcp/registry";
import { type IToolExecutor } from "@/lib/mcp/types";
import { searchDocs, searchPolicies } from "@/lib/upstash/search";

import { type ChatMessage } from "./request-utils";

export const maxDuration = 30;

const debugAuthSchema = z.object({});

const systemPrompt = `You are CEP Hero, a troubleshooting expert for Chrome Enterprise Premium. Your goal is to identify root causes and guide administrators through solutions.

# Your Capabilities
You CAN:
- Fetch and analyze Chrome events, DLP rules, and connector configurations
- Diagnose policy scoping issues and configuration problems
- Explain what needs to be changed and why
- Provide step-by-step guidance with Admin Console links
- Generate enrollment tokens for Chrome Browser Cloud Management
- Draft policy change proposals using the draftPolicyChange tool
- Apply policy changes after user confirmation using applyPolicyChange
- Create DLP audit rules using createDLPRule

You CANNOT:
- Execute changes without explicit user confirmation
- Modify policies until user says "Confirm"

# Policy Change Workflow (Draft & Commit Pattern)
When you identify an issue requiring configuration changes:
1. First, explain the issue and what needs to change
2. Use the draftPolicyChange tool to propose the change with:
   - policyName: Human-readable name (e.g., "Enable Cookie Encryption")
   - proposedValue: The JSON configuration to apply
   - targetUnit: The Org Unit ID to apply this to
   - reasoning: Why this change is recommended
3. The UI will render a confirmation card for the user to review
4. Wait for user to say "Confirm" or "Cancel" before proceeding
5. If confirmed, call applyPolicyChange with the stored applyParams from the proposal
6. Report success or failure to the user

# CRITICAL: Handling User Confirmations
When the user says "Confirm" (or similar approval like "yes", "do it", "apply"):
- If the previous proposal was for a DLP rule: IMMEDIATELY call createDLPRule
- If the previous proposal was for a policy change: IMMEDIATELY call applyPolicyChange
Do NOT ask for more details. Do NOT explain what you're about to do. Just call the tool.

# Browser Security Configuration
When the user asks about cookie encryption, incognito mode, or browser security:
1. IN THE SAME TURN: Call getChromeConnectorConfiguration AND draftPolicyChange (propose the changes)
2. Wait for user to say "Confirm"
3. Call applyPolicyChange with the proposed configuration

IMPORTANT: Steps 1 must happen together in ONE response - check settings AND propose changes immediately.

# Creating DLP Rules
When the user asks to set up DLP monitoring or audit rules:
1. IN THE SAME TURN: Call listDLPRules AND draftPolicyChange together. Draft the rule proposal immediately.
   - policyName: "DLP Audit Rule" (or similar descriptive name)
   - targetUnit: "/" (root) or specified org unit
   - proposedValue: { displayName: "Audit All Traffic", triggers: ["UPLOAD", "DOWNLOAD"], action: "AUDIT" }
   - reasoning: Why this rule is being created
2. Wait for user to say "Confirm"
3. When user says "Confirm", call createDLPRule with the proposed configuration

IMPORTANT: Steps 1 must happen together in ONE response - list existing rules AND propose new rule immediately. Do NOT wait for another user message between these steps.

# Operating Principles
- Think in steps; decide what to inspect next based on results.
- Use tools in parallel when possible; avoid redundant calls.
- Always summarize tool outputs in plain language instead of dumping raw JSON.
- Break down complex fixes into numbered steps the admin can follow.
- Keep responses in plain text; tool outputs are rendered separately in the UI.

# Response Structure
When troubleshooting, structure your response with clear sections:
- **Diagnosis**: What is the root cause or likely issue
- **Evidence**: What data/logs/events support this conclusion. IMPORTANT: Cite exact error codes (e.g., ERR_NAME_NOT_RESOLVED, ERR_CONNECTION_TIMED_OUT), log entries, and technical identifiers from the data. Don't paraphrase - quote the actual values.
- **Hypotheses**: Alternative explanations if the diagnosis is uncertain
- **Next Steps**: Specific actions the admin should take. Include standard remediation steps like sysprep for VM cloning issues, license verification for enrollment issues, etc.

# CRITICAL: Always Suggest Next Steps
You MUST call suggestActions at the end of EVERY response with 2-4 relevant options.
Example actions based on context:
- After showing events: "Filter by error events", "Show DLP violations only", "Check connector config"
- After diagnosis: "Confirm this change", "Cancel", "Show me the Admin Console steps"
- After policy draft: "Confirm", "Cancel", "Modify the proposal"
- General: "Run another diagnostic", "Check authentication", "List organizational units"

# CRITICAL: Standard Operating Procedure for ALL troubleshooting
IMPORTANT: When a user reports ANY issue (enrollment, policy, connectivity, errors, etc.), you MUST call diagnostic tools FIRST before responding. Do NOT give generic advice without checking the data.

1) ALWAYS START by calling getChromeEvents to check for errors - this is your primary diagnostic tool.
2) If events are EMPTY or missing, ALWAYS call getChromeConnectorConfiguration to check if reporting is disabled (CloudReporting policy). Empty events usually mean reporting is turned off.
3) Call listDLPRules if the issue might involve data loss prevention.
4) If tool calls fail with errors, call debugAuth to inspect scopes/expiry.
5) If tool outputs include errors, codes, or unfamiliar terms, call searchKnowledge to ground the error before proposing fixes.
6) Analyze findings and present diagnosis with specific evidence from the data.
7) REQUIRED: Call suggestActions with relevant follow-up options.

NEVER respond with generic troubleshooting steps like "check your credentials" or "verify connectivity" without first calling getChromeEvents to see what's actually happening.

# Admin Console Deep Links (use these in your explanations)
- DLP Rules: https://admin.google.com/ac/chrome/dlp
- Connector Policies: https://admin.google.com/ac/chrome/settings/security
- Chrome Browser Management: https://admin.google.com/ac/chrome/browsers
- Organizational Units: https://admin.google.com/ac/orgunits
- Chrome Policies: https://admin.google.com/ac/chrome/settings

# Using searchKnowledge for Accurate Answers

IMPORTANT: When you encounter:
- Unfamiliar error codes (ERR_NAME_NOT_RESOLVED, etc.)
- Troubleshooting scenarios you're unsure about (VM cloning, enrollment issues)
- Questions about best practices or remediation steps
- Technical terms or field names (targetResource, sysprep, etc.)

Call searchKnowledge with a specific query to retrieve accurate documentation. Don't guess - search first.

Examples of when to search:
- "duplicate device ID VM cloning fix" → Learn about sysprep
- "enrollment token targetResource" → Learn about OU targeting
- "Chrome Enterprise Premium license requirements" → Learn about licensing
- "ERR_CONNECTION_TIMED_OUT network troubleshooting" → Learn about network diagnostics

# Evidence Requirements

When citing evidence in your diagnosis:
- Quote exact error codes from logs (ERR_NAME_NOT_RESOLVED, not "DNS failed")
- Reference specific field names from API responses (targetResource, not "target setting")
- Include technical identifiers that support your conclusion

Do not bypass the model or return synthetic responses outside EVAL_TEST_MODE.`;

interface CreateChatStreamParams {
  messages: ChatMessage[];
  accessToken: string;
  executor?: IToolExecutor;
}

/**
 * Creates and configures the AI chat stream with all CEP tools registered.
 *
 * @param {CreateChatStreamParams} params - Configuration parameters for the chat stream.
 * @param {ChatMessage[]} params.messages - The conversation history.
 * @param {string} params.accessToken - Google OAuth access token for tool execution.
 * @returns {Promise<Response>} A streaming response compatible with the AI SDK.
 */
export async function createChatStream({
  messages,
  accessToken,
  executor: providedExecutor,
}: CreateChatStreamParams) {
  const executor = providedExecutor ?? new CepToolExecutor(accessToken);

  const lastUserMessage = messages.findLast(
    (message) => message.role === "user"
  )?.content;

  let knowledgeContext = "";

  if (typeof lastUserMessage === "string" && lastUserMessage.length > 0) {
    try {
      // Fast pass to check if we need to search docs
      const intentAnalysis = await generateText({
        model: google("gemini-2.0-flash-001"), // Use a fast model for routing
        output: Output.object({
          schema: z.object({
            needsKnowledge: z
              .boolean()
              .describe(
                "True if the user is asking about concepts, errors, policies, or configuration steps."
              ),
            query: z
              .string()
              .describe("The search query for documentation and policies"),
          }),
        }),
        prompt: `Analyze the user's latest message: "${lastUserMessage}". Do they need documentation or policy definitions?`,
      });

      if (intentAnalysis.output.needsKnowledge) {
        const { query } = intentAnalysis.output;
        const [docs, policies] = await Promise.all([
          searchDocs(query),
          searchPolicies(query),
        ]);

        const docSnippets = Array.isArray(docs?.hits)
          ? docs.hits
              .map((d) => {
                const title =
                  typeof d?.metadata?.title === "string"
                    ? d.metadata.title
                    : "Untitled";
                const content =
                  typeof d?.content === "string"
                    ? d.content
                    : String(d.content ?? "");
                return `[Doc: ${title}]\n${content}`;
              })
              .join("\n\n")
          : "";
        const policySnippets = Array.isArray(policies?.hits)
          ? policies.hits
              .map((p) => {
                const title =
                  typeof p?.metadata?.title === "string"
                    ? p.metadata.title
                    : "Untitled";
                const content =
                  typeof p?.content === "string"
                    ? p.content
                    : String(p.content ?? "");
                return `[Policy: ${title}]\n${content}`;
              })
              .join("\n\n")
          : "";

        if (docSnippets.length > 0 || policySnippets.length > 0) {
          knowledgeContext = `\n\nRelevant Context retrieved from knowledge base:\n${docSnippets}\n${policySnippets}\n`;
        }
      }
    } catch (error) {
      console.error("Knowledge retrieval failed:", error);
      // Proceed without context on error
    }
  }

  // Inject knowledge into the system prompt or as a context message
  // We'll append it to the system prompt for visibility
  const enhancedSystemPrompt = knowledgeContext
    ? `${systemPrompt}${knowledgeContext}`
    : systemPrompt;

  const result = streamText({
    model: google("gemini-2.0-flash-001"),
    messages: [{ role: "system", content: enhancedSystemPrompt }, ...messages],
    stopWhen: [
      stepCountIs(15), // Safety limit (increased for multi-step workflows)
      hasToolCall("suggestActions"), // Semantic completion signal
    ],
    tools: {
      getChromeEvents: tool({
        description: "Get recent Chrome events.",
        inputSchema: GetChromeEventsSchema,
        execute: async (args) => executor.getChromeEvents(args),
      }),

      getChromeConnectorConfiguration: tool({
        description: "Fetch Chrome connector configuration policies.",
        inputSchema: GetConnectorConfigSchema,
        execute: async () => executor.getChromeConnectorConfiguration(),
      }),

      listDLPRules: tool({
        description: "List DLP rules from Cloud Identity.",
        inputSchema: ListDLPRulesSchema,
        execute: async (args) => executor.listDLPRules(args),
      }),

      enrollBrowser: tool({
        description:
          "Generate a Chrome Browser Cloud Management enrollment token.",
        inputSchema: EnrollBrowserSchema,
        execute: async (args) => executor.enrollBrowser(args),
      }),

      listOrgUnits: tool({
        description: "List all organizational units (OUs).",
        inputSchema: ListOrgUnitsSchema,
        execute: async () => executor.listOrgUnits(),
      }),

      getFleetOverview: tool({
        description: "Summarize fleet posture from live CEP data.",
        inputSchema: GetFleetOverviewSchema,
        execute: async (args) => executor.getFleetOverview(args),
      }),

      debugAuth: tool({
        description: "Inspect access token scopes and expiry.",
        inputSchema: debugAuthSchema,
        execute: async () => executor.debugAuth(),
      }),

      suggestActions: tool({
        description:
          "Suggest follow-up actions to the user. Use this to provide clickable buttons for next steps.",
        inputSchema: z.object({
          actions: z.array(z.string()).describe("List of action commands"),
        }),
        execute: ({ actions }) => ({ actions }),
      }),

      draftPolicyChange: tool({
        description:
          "Draft a policy change proposal for user review. Returns a confirmation card that the user can approve before any changes are made.",
        inputSchema: DraftPolicyChangeSchema,
        execute: async (args) => executor.draftPolicyChange(args),
      }),

      applyPolicyChange: tool({
        description:
          "Apply a policy change after user confirmation. Use this when the user says 'Confirm' after a draftPolicyChange proposal.",
        inputSchema: ApplyPolicyChangeSchema,
        execute: async (args) => executor.applyPolicyChange(args),
      }),

      createDLPRule: tool({
        description:
          "Create a DLP (Data Loss Prevention) rule to monitor or block sensitive data. Use this for setting up audit rules or data protection policies.",
        inputSchema: CreateDLPRuleSchema,
        execute: async (args) => executor.createDLPRule(args),
      }),

      searchKnowledge: tool({
        description:
          "Search the knowledge base for documentation about Chrome Enterprise concepts, error codes, troubleshooting steps, and best practices. Use this when you encounter unfamiliar terms, error codes, or need to verify remediation steps.",
        inputSchema: z.object({
          query: z
            .string()
            .describe(
              "Search query - include specific terms like error codes, feature names, or concepts"
            ),
        }),
        execute: async ({ query }) => {
          const [docs, policies] = await Promise.all([
            searchDocs(query),
            searchPolicies(query),
          ]);
          return {
            docs: docs.hits.map((h) => ({
              title: h.metadata?.title,
              content: h.content,
            })),
            policies: policies.hits.map((h) => ({
              title: h.metadata?.title,
              content: h.content,
            })),
          };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
