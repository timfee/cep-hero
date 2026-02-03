import { Index } from "@upstash/vector";

import {
  getSupportedOnText,
  type PolicyDefinition,
  type PolicyTemplates,
} from "./policy-types";
import {
  BATCH_SIZE,
  UPSTASH_MAX_DATA_SIZE,
  type PolicyDocument,
} from "./vector-types";

function generatePolicyMarkdown(policy: PolicyDefinition): string {
  const sections: string[] = [`# ${policy.caption || policy.name}`, ""];

  const metadata: string[] = [];
  if (policy.name) {
    metadata.push(`**Policy Name:** \`${policy.name}\``);
  }
  if (policy.id) {
    metadata.push(`**Policy ID:** ${policy.id}`);
  }
  if (policy.deprecated === true) {
    metadata.push("**Status:** Deprecated");
  }
  if (policy.device_only === true) {
    metadata.push(`**Scope:** Device-only`);
  }

  if (metadata.length > 0) {
    sections.push(metadata.join("  \n"));
    sections.push("");
  }

  if (typeof policy.desc === "string" && policy.desc.length > 0) {
    sections.push("## Description");
    sections.push("");
    sections.push(policy.desc);
    sections.push("");
  }

  if (Array.isArray(policy.supported_on) && policy.supported_on.length > 0) {
    sections.push("## Supported Platforms");
    sections.push("");
    sections.push(policy.supported_on.map((p: string) => `- ${p}`).join("\n"));
    sections.push("");
  }

  if (
    typeof policy.type === "string" ||
    policy.schema !== undefined ||
    (Array.isArray(policy.items) && policy.items.length > 0)
  ) {
    sections.push("## Configuration");
    sections.push("");

    if (typeof policy.type === "string" && policy.type.length > 0) {
      sections.push(`**Type:** ${policy.type}`);
      sections.push("");
    }

    if (Array.isArray(policy.items) && policy.items.length > 0) {
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

  if (policy.features !== undefined && policy.features !== null) {
    const features: string[] = [];
    if (policy.features.dynamic_refresh === true) {
      features.push("Dynamic refresh supported");
    }
    if (policy.features.per_profile === true) {
      features.push("Per-profile configuration");
    }
    if (policy.features.can_be_recommended === true) {
      features.push("Can be set as recommended");
    }
    if (policy.features.can_be_mandatory === true) {
      features.push("Can be set as mandatory");
    }

    if (features.length > 0) {
      sections.push("## Features");
      sections.push("");
      sections.push(features.map((f) => `- ${f}`).join("\n"));
      sections.push("");
    }
  }

  if (Array.isArray(policy.tags) && policy.tags.length > 0) {
    sections.push("## Tags");
    sections.push("");
    sections.push(policy.tags.map((tag: string) => `\`${tag}\``).join(" "));
    sections.push("");
  }

  return sections.join("\n");
}

async function processPolicyDocs(documents: PolicyDocument[]): Promise<void> {
  if (documents.length === 0) {
    console.log("No policy documents to process.");
    return;
  }

  console.log(`Processing ${documents.length} policy documents...`);

  const batches: PolicyDocument[][] = [];
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    batches.push(documents.slice(i, i + BATCH_SIZE));
  }

  console.log(
    `Processing ${batches.length} batches of up to ${BATCH_SIZE} documents each...`
  );

  const index = Index.fromEnv();

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    console.log(`\nBatch ${i + 1}/${batches.length}:`);

    try {
      const results = await Promise.allSettled(
        batch.map((doc) => {
          console.log(`  Working on: ${doc.title}`);

          return index.upsert({
            id: doc.id,
            data: doc.content.slice(0, UPSTASH_MAX_DATA_SIZE),
            metadata: {
              kind: doc.kind,
              title: doc.title,
              url: doc.url,
              policyId: doc.metadata.policyId,
              policyName: doc.metadata.policyName,
              deprecated: doc.metadata.deprecated,
              deviceOnly: doc.metadata.deviceOnly,
              supportedPlatforms: doc.metadata.supportedPlatforms,
              supportedPlatformsText: doc.metadata.supportedPlatformsText,
              tags: doc.metadata.tags,
              features: doc.metadata.features,
            },
          });
        })
      );

      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      if (failed > 0) {
        console.log(`  ${failed} documents failed to process`);
      }
      console.log(`  ${successful} documents processed successfully`);
    } catch (error) {
      console.error(`Failed to process batch ${i + 1}:`, error);
    }
  }

  console.log("\nAll policy documents processed successfully.");
}

const API_URL =
  "https://chromeenterprise.google/static/json/policy_templates_en-US.json";

async function main() {
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

  const documents: PolicyDocument[] = data.policy_definitions.map((policy) => {
    const policyUrl = `https://chromeenterprise.google/policies/#${policy.name}`;

    return {
      id: policyUrl,
      content: generatePolicyMarkdown(policy),
      kind: "chrome-enterprise-policy",
      url: policyUrl,
      title: policy.caption || policy.name,
      metadata: {
        policyId: policy.id,
        policyName: policy.name,
        deprecated: policy.deprecated,
        deviceOnly: policy.device_only,
        supportedPlatforms: policy.supported_on,
        supportedPlatformsText: getSupportedOnText(policy),
        tags: policy.tags,
        features: {
          dynamicRefresh: policy.features?.dynamic_refresh,
          perProfile: policy.features?.per_profile,
          canBeRecommended: policy.features?.can_be_recommended,
          canBeMandatory: policy.features?.can_be_mandatory,
          cloudOnly: policy.features?.cloud_only,
          userOnly: policy.features?.user_only,
        },
      },
    };
  });

  console.log(
    `Generated ${documents.length} policy documents with rich metadata`
  );

  await processPolicyDocs(documents);
}

function isPolicyTemplates(value: unknown): value is PolicyTemplates {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return Array.isArray(record.policy_definitions);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await main();
  } catch (error) {
    console.error(error);
  }
}
