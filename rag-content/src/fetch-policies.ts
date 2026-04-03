/**
 * Fetches Chrome Enterprise policy templates and writes each policy as a markdown file.
 */

import {
  getSupportedOnText,
  type PolicyDefinition,
  type PolicyTemplates,
  type RagDocument,
} from "./types.js";
import { slugify, writeDocuments } from "./utils.js";

const API_URL =
  "https://chromeenterprise.google/static/json/policy_templates_en-US.json";


/**
 * Generate markdown documentation for a single policy.
 */
function generatePolicyMarkdown(policy: PolicyDefinition): string {
  const sections: string[] = [`# ${policy.caption || policy.name}`, ""];

  const metadata: string[] = [];
  if (policy.name) {
    metadata.push(`**Policy Name:** \`${policy.name}\``);
  }
  if (policy.id) {
    metadata.push(`**Policy ID:** ${policy.id}`);
  }
  if (policy.deprecated) {
    metadata.push("**Status:** Deprecated");
  }
  if (policy.device_only) {
    metadata.push(`**Scope:** Device-only`);
  }

  if (metadata.length > 0) {
    sections.push(metadata.join("  \n"));
    sections.push("");
  }

  if (policy.desc) {
    sections.push("## Description");
    sections.push("");
    sections.push(policy.desc);
    sections.push("");
  }

  if (policy.supported_on?.length) {
    sections.push("## Supported Platforms");
    sections.push("");
    sections.push(policy.supported_on.map((p: string) => `- ${p}`).join("\n"));
    sections.push("");
  }

  if (
    typeof policy.type === "string" ||
    policy.schema !== undefined ||
    policy.items?.length
  ) {
    sections.push("## Configuration");
    sections.push("");

    if (policy.type) {
      sections.push(`**Type:** ${policy.type}`);
      sections.push("");
    }

    if (policy.items?.length) {
      sections.push("### Available Options");
      sections.push("");
      for (const item of policy.items) {
        const value = JSON.stringify(item.value);
        const caption = item.caption ?? item.name ?? value;
        sections.push(`- **${caption}** (${value})`);
      }
      sections.push("");
    }

    if (policy.example_value !== undefined) {
      sections.push("### Example");
      sections.push("");
      sections.push("```json");
      sections.push(JSON.stringify(policy.example_value, null, 2));
      sections.push("```");
      sections.push("");
    }

    if (policy.default !== undefined) {
      sections.push(`**Default:** \`${JSON.stringify(policy.default)}\``);
      sections.push("");
    }
  }

  if (policy.features) {
    const features: string[] = [];
    if (policy.features.dynamic_refresh) {
      features.push("Dynamic refresh supported");
    }
    if (policy.features.per_profile) {
      features.push("Per-profile configuration");
    }
    if (policy.features.can_be_recommended) {
      features.push("Can be set as recommended");
    }
    if (policy.features.can_be_mandatory) {
      features.push("Can be set as mandatory");
    }

    if (features.length > 0) {
      sections.push("## Features");
      sections.push("");
      sections.push(features.map((f) => `- ${f}`).join("\n"));
      sections.push("");
    }
  }

  if (policy.tags?.length) {
    sections.push("## Tags");
    sections.push("");
    sections.push(policy.tags.map((tag: string) => `\`${tag}\``).join(" "));
    sections.push("");
  }

  return sections.join("\n");
}


/**
 * Type guard for the policy templates API response.
 */
function isPolicyTemplates(value: unknown): value is PolicyTemplates {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return Array.isArray(record.policy_definitions);
}


/**
 * Fetch all Chrome Enterprise policies and write them as markdown files.
 */
export async function main(): Promise<void> {
  console.log("Fetching Chrome Enterprise policy templates...");

  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch policies: ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!isPolicyTemplates(data)) {
    throw new Error("Unexpected policy template response shape");
  }
  console.log(`Found ${data.policy_definitions.length} policies`);

  const documents: RagDocument[] = data.policy_definitions.map((policy) => {
    const policyUrl = `https://chromeenterprise.google/policies/#${policy.name}`;

    return {
      filename: slugify(policy.name),
      title: policy.caption || policy.name,
      url: policyUrl,
      kind: "chrome-enterprise-policy",
      content: generatePolicyMarkdown(policy),
      metadata: {
        policyId: policy.id,
        policyName: policy.name,
        deprecated: policy.deprecated ?? false,
        deviceOnly: policy.device_only ?? false,
        supportedPlatformsText: getSupportedOnText(policy),
        tags: policy.tags,
        features: {
          dynamicRefresh: policy.features?.dynamic_refresh ?? false,
          perProfile: policy.features?.per_profile ?? false,
          canBeRecommended: policy.features?.can_be_recommended ?? false,
          canBeMandatory: policy.features?.can_be_mandatory ?? false,
          cloudOnly: policy.features?.cloud_only ?? false,
          userOnly: policy.features?.user_only ?? false,
        },
      },
    };
  });

  console.log(
    `Generated ${documents.length} policy documents with rich metadata`,
  );
  writeDocuments("policies", documents);
}


if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
