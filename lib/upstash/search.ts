/**
 * Vector search utilities for retrieving documentation and policy context.
 */

import { Index } from "@upstash/vector";

const DOCS_NAMESPACE = "docs";
const POLICY_NAMESPACE = "policies";

export interface VectorSearchHit {
  id: string | number;
  score: number;
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface VectorSearchResult {
  namespace: "docs" | "policies";
  hits: VectorSearchHit[];
}

/**
 * Search documentation vectors for troubleshooting context.
 */
export async function searchDocs(
  query: string,
  topK = 3
): Promise<VectorSearchResult> {
  const index = new Index();
  const result = await index.namespace(DOCS_NAMESPACE).query({
    data: query,
    topK,
    includeMetadata: true,
    includeData: true,
  });

  return {
    namespace: "docs",
    hits:
      result?.map((hit) => ({
        id: hit.id,
        score: hit.score,
        content: hit.data,
        metadata: hit.metadata ?? undefined,
      })) ?? [],
  };
}

/**
 * Search policy vectors separately to avoid noisy results.
 */
export async function searchPolicies(
  query: string,
  topK = 4
): Promise<VectorSearchResult> {
  const index = new Index();
  const result = await index.namespace(POLICY_NAMESPACE).query({
    data: query,
    topK,
    includeMetadata: true,
    includeData: true,
  });

  return {
    namespace: "policies",
    hits:
      result?.map((hit) => ({
        id: hit.id,
        score: hit.score,
        content: hit.data,
        metadata: hit.metadata ?? undefined,
      })) ?? [],
  };
}
