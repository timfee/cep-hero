/**
 * Type definitions for the Chrome Enterprise Policy vector database and search functionality.
 * Includes policy templates, Upstash Vector metadata, crawler document types, and search result interfaces.
 */

/**
 * Semantic user interaction model for a policy that maps to UI components.
 */
export enum PolicyType {
  Boolean = "boolean",
  SingleChoice = "single_choice",
  MultipleChoice = "multiple_choice",
  FreeformInput = "freeform_input",
  StringList = "string_list",
  StructuredObject = "structured_object",
}

/**
 * Schema structure for policy value validation and documentation.
 */
export interface Schema {
  type: string;
  description?: string;
  enum?: (string | number | boolean | null)[];
  minimum?: number;
  maximum?: number;
  properties?: Record<string, Schema>;
  patternProperties?: Record<string, Schema>;
  additionalProperties?: Schema | boolean;
  items?: Schema | { type: string };
  required?: string[];
  sensitiveValue?: boolean;
}

/**
 * A selectable option within a policy for enum-based types.
 */
export interface Item {
  caption: string;
  value: string | number | boolean | null;
  name?: string;
  supported_on?: string[];
}

/**
 * Feature flags and metadata describing policy behavior.
 */
export interface Features {
  can_be_recommended?: boolean;
  dynamic_refresh?: boolean;
  per_profile?: boolean;
  cloud_only?: boolean;
  unlisted?: boolean;
  can_be_mandatory?: boolean;
  user_only?: boolean;
  internal_only?: boolean;
  platform_only?: boolean;
  metapolicy_type?: string;
}

/**
 * Any valid JSON value for flexible policy field types.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * A complete Chrome Enterprise policy definition.
 */
export interface PolicyDefinition {
  id: number;
  name: string;
  type: PolicyType;
  caption: string;
  desc: string;
  supported_on: string[];
  owners: string[];
  tags: string[];
  features: Features;
  schema: Schema;
  example_value: JsonValue;
  default: JsonValue;
  items?: Item[];
  device_only?: boolean;
  generate_device_proto?: boolean;
  deprecated?: boolean;
  default_for_enterprise_users?: JsonValue;
  description_schema?: Schema;
  validation_schema?: Schema;
  future_on?: string[];
  arc_support?: string;
  max_size?: number;
  sensitive?: boolean;
  default_for_managed_devices_doc_only?: boolean;
  label?: string;
  url_schema?: string;
  default_policy_level?: string;
}

/**
 * A group of related policies treated as an atomic unit for conflict resolution.
 */
export interface PolicyAtomicGroupDefinition {
  caption: string;
  id: number;
  name: string;
  policies: string[];
}

/**
 * A localized message string for UI elements.
 */
export interface Message {
  text: string;
}

/**
 * Dictionary of all UI messages keyed by identifier.
 */
export type Messages = Record<string, Message>;

/**
 * Top-level policy templates structure containing all definitions.
 */
export interface PolicyTemplates {
  policy_definitions: PolicyDefinition[];
  policy_atomic_group_definitions: PolicyAtomicGroupDefinition[];
  messages: Messages;
}

/**
 * Base interface for documents processed by crawler scripts.
 */
export interface BaseDocument {
  id: string;
  content: string;
  kind: string;
  url: string;
  title: string;
}

/**
 * Document type for help articles and documentation.
 */
export interface Document extends BaseDocument {
  metadata?: {
    articleType?: string;
    articleId?: string;
  };
}

/**
 * Document type for Chrome Enterprise policy definitions.
 */
export interface PolicyDocument extends BaseDocument {
  metadata: {
    policyId: number;
    policyName: string;
    deprecated?: boolean;
    deviceOnly?: boolean;
    supportedPlatforms?: string[];
    supportedPlatformsText?: string;
    tags?: string[];
    features?: {
      dynamicRefresh?: boolean;
      perProfile?: boolean;
      canBeRecommended?: boolean;
      canBeMandatory?: boolean;
      cloudOnly?: boolean;
      userOnly?: boolean;
    };
  };
}

/**
 * Base metadata that all vectors in Upstash must have.
 */
export interface BaseVectorMetadata {
  [key: string]: unknown;
  kind: string;
  title: string;
  url: string;
  crawledAt: Date;
}

/**
 * Vector metadata for policy documents.
 */
export type PolicyVectorMetadata = BaseVectorMetadata &
  PolicyDocument["metadata"];

/**
 * Vector metadata for article documents.
 */
export type ArticleVectorMetadata = BaseVectorMetadata &
  NonNullable<Document["metadata"]>;

/**
 * Generic search result format for search tools.
 */
export interface SearchResult {
  resourceId: string;
  rank: number;
  title?: string;
  content: string;
  score: number;
}

/**
 * Structured search result for policy searches.
 */
export interface PolicySearchResult {
  resourceId: string;
  rank: number;
  policyName?: string;
  policyId?: number;
  deprecated?: boolean;
  deviceOnly?: boolean;
  platforms?: string[];
  tags?: string[];
  content: string;
  score: number;
  url?: string;
}

/**
 * Structured search result for article searches.
 */
export interface ArticleSearchResult {
  resourceId: string;
  rank: number;
  title?: string;
  articleType?: string;
  articleId?: string;
  content: string;
  score: number;
  url?: string;
}

export const UPSTASH_MAX_DATA_SIZE = 1024 * 1024;
export const BATCH_SIZE = 100;
export const MAX_REQUESTS = 500;
export const MAX_CONCURRENCY = 10;
