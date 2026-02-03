/**
 * Shared utilities for vector database scripts including HTML conversion and batch processing.
 */

import { Index } from "@upstash/vector";
import TurndownService from "turndown";

import {
  BATCH_SIZE,
  UPSTASH_MAX_DATA_SIZE,
  type Document,
} from "./vector-types";

export const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

/**
 * Normalize a URL to a standard ID format without query parameters or hash.
 */
export function getStandardId(url: string) {
  try {
    const urlObj = new URL(url);
    return urlObj.origin + urlObj.pathname;
  } catch {
    return url;
  }
}

/**
 * Process and upsert documents to Upstash Vector in batches.
 */
export async function processDocs(documents: Document[]) {
  if (documents.length === 0) {
    console.log("No documents to process.");
    return;
  }

  console.log(`Processing ${documents.length} documents...`);

  const batches: Document[][] = [];
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

    await Promise.all(
      batch.map(async (doc) => {
        console.log(`  Working on: ${doc.title}`);

        await index.upsert({
          id: doc.id,
          data: doc.content.slice(0, UPSTASH_MAX_DATA_SIZE),
          metadata: {
            kind: doc.kind,
            title: doc.title,
            url: doc.url,
            ...doc.metadata,
          },
        });
      })
    );
  }

  console.log("\nAll documents processed successfully.");
}
