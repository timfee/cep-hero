/**
 * @file Comprehensive type definitions for the Chrome Enterprise Policy (CEP) Guru application.
 *
 * This file consolidates all type definitions used across the application including:
 * - Chrome Enterprise policy templates and definitions from policy_templates_en-US.json
 * - Upstash Vector database metadata types for search functionality
 * - Crawler document types for data processing
 * - Search result interfaces for API responses
 *
 * The types are structured to provide strong typing for the entire data pipeline:
 * crawler scripts → vector database → search tools → API responses
 */

// ============================================================================
// CHROME ENTERPRISE POLICY TYPES
// ============================================================================

/**
 * Represents the semantic user interaction model for a policy.
 * This provides a more abstract and UI-friendly classification than the raw
 * data types (like 'main', 'int-enum', 'string-enum-list') found in the
 * original schema. It groups policies by how a user would interact with them,
 * making it easier to map a policy to a UI component.
 */
export enum PolicyType {
  /**
   * Represents a simple on/off or true/false toggle.
   * This typically maps from the original 'main' type where the schema.type is 'boolean'.
   */
  Boolean = "boolean",

  /**
   * Represents a selection from a list of mutually exclusive options (e.g., radio buttons).
   * This maps from original types like 'int-enum' and 'string-enum'. The available
   * choices are defined in the `items` array of a `PolicyDefinition`.
   */
  SingleChoice = "single_choice",

  /**
   * Represents a selection of one or more options from a list (e.g., checkboxes).
   * This maps from the original 'string-enum-list' type. The available
   * choices are defined in the `items` array of a `PolicyDefinition`.
   */
  MultipleChoice = "multiple_choice",

  /**
   * Represents an open field for user-provided text, numbers, or URLs.
   * This maps from original types like 'string' and 'int'.
   */
  FreeformInput = "freeform_input",

  /**
   * Represents a list of user-provided strings, typically for URL patterns or IDs.
   * This maps from the original 'list' type.
   */
  StringList = "string_list",

  /**
   * Represents a complex JSON object with specific key-value pairs, or a reference to an external file.
   * This maps from original types like 'dict' and 'external'. The structure is
   * defined in the `schema` property.
   */
  StructuredObject = "structured_object",
}

/**
 * Describes the structure for a schema object, used within policy definitions
 * for validation and to describe the expected data structure. This is the blueprint
 * for the policy's value.
 */
export interface Schema {
  /** The fundamental data type (e.g., 'boolean', 'integer', 'string', 'object', 'array'). */
  type: string;
  /** An optional detailed description of the schema's purpose or structure. */
  description?: string;
  /** A list of permitted literal values for enum-based types. */
  enum?: (string | number | boolean | null)[];
  /** The minimum numeric value allowed for an 'integer' type. */
  minimum?: number;
  /** The maximum numeric value allowed for an 'integer' type. */
  maximum?: number;
  /** For 'object' types, this is a record of nested schema properties. */
  properties?: Record<string, Schema>;
  /** For 'object' types with dynamic keys, this defines schemas for keys matching a regex pattern. */
  patternProperties?: Record<string, Schema>;
  /** For 'object' types, defines the schema for any additional properties not explicitly listed. */
  additionalProperties?: Schema | boolean;
  /** For 'array' types, this defines the schema for each item in the array. */
  items?: Schema | { type: string };
  /** For 'object' types, an array of property names that are required. */
  required?: string[];
  /** Indicates if the value should be treated as sensitive (e.g., passwords, tokens) and possibly masked in UIs. */
  sensitiveValue?: boolean;
}

/**
 * Represents a single selectable option within a policy, typically used for
 * enums (`single_choice` or `multiple_choice` types).
 */
export interface Item {
  /** The user-facing text label for the option (e.g., "Enable feature X"). */
  caption: string;
  /** The actual value to be stored when this option is selected (e.g., `true`, `1`, `'enabled'`). */
  value: string | number | boolean | null;
  /** An optional programmatic name for the item, often used in code. */
  name?: string;
  /** An optional array of platforms and versions where this specific item is supported. */
  supported_on?: string[];
}

/**
 * Represents the feature flags and metadata associated with a policy, detailing
 * its behavior and how it can be applied.
 */
export interface Features {
  /** If true, the policy can be set as 'recommended', which means the user can override the admin's suggested setting. */
  can_be_recommended?: boolean;
  /** If true, the policy supports being updated and applied while the browser is running, without a restart. */
  dynamic_refresh?: boolean;
  /** If true, the policy can be applied on a per-profile basis. If false, it's a machine-level policy. */
  per_profile?: boolean;
  /** If true, the policy is only configurable via the cloud-based Google Admin console. */
  cloud_only?: boolean;
  /** If true, the policy is not typically listed in public documentation. */
  unlisted?: boolean;
  /** If true, the policy can be set as 'mandatory', meaning the user cannot override the admin's setting. */
  can_be_mandatory?: boolean;
  /** If true, the policy applies only to user-level configurations, not machine-level. */
  user_only?: boolean;
  /** If true, the policy is for internal Google use only. */
  internal_only?: boolean;
  /** If true, the policy is specific to a certain platform (e.g., Windows-only). */
  platform_only?: boolean;
  /** For metapolicies, defines the type of behavior (e.g., 'precedence', 'merge') for resolving policy conflicts. */
  metapolicy_type?: string;
}

/**
 * Represents any valid JSON value. This is used for fields like `default`
 * and `example_value` that can hold various data types depending on the policy,
 * providing a type-safe alternative to `any`.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * Represents a single, complete policy definition. This is the core object for
 * understanding and rendering a policy.
 */
export interface PolicyDefinition {
  /** A unique numeric identifier for the policy. */
  id: number;
  /** The programmatic name of the policy (e.g., 'AccessibilityShortcutsEnabled'). Used in registry keys and preference files. */
  name: string;
  /**
   * The semantic type of the policy, which helps determine the appropriate UI control to render.
   * This is derived from the original `type` field in the JSON.
   */
  type: PolicyType;
  /**
   * A short, user-facing caption for the policy.
   * This is the title of the policy. It almost always begins with a directive verb (e.g., "Enable...", "Allow...", "Set...").
   */
  caption: string;
  /**
   * A detailed description of the policy's function and behavior. This is the primary source of documentation.
   * This field often contains rich, structured information:
   * - **Conditional Logic:** Frequently uses an "If this policy is set to [X], then..." or "Setting the policy to [Y] means..." structure to explain outcomes.
   * - **Technical Terms:** Includes specific names of APIs, protocols, and products (e.g., 'Kerberos', 'SAML', 'WebRTC', 'Google ChromeOS').
   * - **Placeholders:** Uses template strings for dynamic values (e.g., '{searchTerms}', '${url}', '${LOGIN_EMAIL}').
   * - **Rationale:** Often explains the security, privacy, or performance implications of a setting.
   * - **Versioning:** May include notes about deprecation, version support ranges, or future removal.
   */
  desc: string;
  /** An array of strings indicating supported platforms and versions (e.g., 'chrome_os:81-', 'chrome.*:10-87'). */
  supported_on: string[];
  /** An array of owner contacts (email addresses) or file paths for code ownership. */
  owners: string[];
  /** An array of tags for categorization (e.g., 'system-security', 'filtering', 'google-sharing'). */
  tags: string[];
  /** An object containing feature flags and metadata for the policy. */
  features: Features;
  /** The schema that defines the structure and validation rules for the policy's value. */
  schema: Schema;
  /** An example value for the policy, demonstrating correct formatting. */
  example_value: JsonValue;
  /** The default value for the policy if it's not set. Can be `null` if user choice is the default. */
  default: JsonValue;
  /** An optional array of selectable items for `single_choice` or `multiple_choice` policies. */
  items?: Item[];
  /** If true, the policy applies to the entire device, not just a user profile. */
  device_only?: boolean;
  /** A flag related to device protocol generation for ChromeOS. */
  generate_device_proto?: boolean;
  /** If true, the policy is deprecated and may be removed in a future version. */
  deprecated?: boolean;
  /** The default value specifically for enterprise users, which can differ from the consumer default. */
  default_for_enterprise_users?: JsonValue;
  /** An optional, more detailed schema for the description content itself. */
  description_schema?: Schema;
  /** An optional schema for validating the policy's value, often more detailed than the main `schema` for complex `dict` types. */
  validation_schema?: Schema;
  /** An array indicating planned future platform support. */
  future_on?: string[];
  /** A note specifically for Android (ARC) support on ChromeOS, explaining how the policy interacts with Android apps. */
  arc_support?: string;
  /** The maximum size in bytes for policies of type `external` which reference a downloadable file. */
  max_size?: number;
  /** If true, the policy's value may contain sensitive information (e.g., tokens, private URLs) and should be handled with care. */
  sensitive?: boolean;
  /** A documentation-only flag indicating the default value on managed devices. */
  default_for_managed_devices_doc_only?: boolean;
  /** An alternative label for the policy, sometimes used in UIs. */
  label?: string;
  /** A URL to external, detailed documentation for a complex schema. */
  url_schema?: string;
  /** The default level of the policy (e.g., 'recommended'). */
  default_policy_level?: string;
}

/**
 * Represents a group of related policies that must be treated as a single,
 * atomic unit, especially concerning policy source priority. If policies from
 * different sources are in the same group, only those from the highest-priority
 * source will be applied.
 */
export interface PolicyAtomicGroupDefinition {
  /** The user-facing name of the group. */
  caption: string;
  /** A unique numeric identifier for the group. */
  id: number;
  /** The programmatic name of the group. */
  name: string;
  /** An array of policy names (`PolicyDefinition.name`) belonging to this group. */
  policies: string[];
}

/**
 * Represents a single message string used for UI elements, allowing for
 * localization and centralized text management across the policy documentation.
 */
export interface Message {
  /** The text content of the message. May contain placeholders like '$6'. */
  text: string;
}

/**
 * A dictionary of all UI messages used in the policy documentation,
 * keyed by a unique string identifier (e.g., 'doc_deprecated').
 */
export type Messages = Record<string, Message>;

/**
 * The top-level type for the entire policy templates JSON structure, containing
 * all policy definitions, groups, and UI messages.
 */
export interface PolicyTemplates {
  /** An array of all individual policy definitions. */
  policy_definitions: PolicyDefinition[];
  /** An array of all atomic policy group definitions. */
  policy_atomic_group_definitions: PolicyAtomicGroupDefinition[];
  /** A dictionary of all UI messages. */
  messages: Messages;
}

// ============================================================================
// CRAWLER DOCUMENT TYPES
// ============================================================================

/**
 * Base interface for all documents processed by the crawler scripts.
 * This defines the core structure that all document types must have.
 */
export interface BaseDocument {
  /** Unique identifier for the document, typically derived from the URL */
  id: string;
  /** The processed content of the document (often converted from HTML to Markdown) */
  content: string;
  /** The type/category of document (e.g., 'chrome-policy', 'help-article', 'cloud-doc') */
  kind: string;
  /** The source URL where the document was crawled from */
  url: string;
  /** The title or heading of the document */
  title: string;
}

/**
 * Document type for general Chrome Enterprise articles and help documentation.
 * Used by the helpcenter and cloud crawlers for documentation articles.
 */
export interface Document extends BaseDocument {
  /** Optional metadata specific to help articles and documentation */
  metadata?: {
    /** The type of article (e.g., 'help-article', 'admin-guide', 'troubleshooting') */
    articleType?: string;
    /** The internal ID of the article from the source system */
    articleId?: string;
  };
}

/**
 * Document type specifically for Chrome Enterprise policy definitions.
 * Used by the policy crawler to store structured policy information.
 */
export interface PolicyDocument extends BaseDocument {
  /** Required metadata for policy documents with comprehensive policy information */
  metadata: {
    /** The numeric ID of the policy from the policy templates */
    policyId: number;
    /** The human-readable name of the policy */
    policyName: string;
    /** Whether the policy is deprecated and may be removed in future versions */
    deprecated?: boolean;
    /** Whether the policy applies only to device-level configurations */
    deviceOnly?: boolean;
    /** Array of supported platforms in raw format (e.g., ['chrome_os:81-', 'chrome.*:10-87']) */
    supportedPlatforms?: string[];
    /** Human-readable text describing platform support */
    supportedPlatformsText?: string;
    /** Array of categorization tags for the policy */
    tags?: string[];
    /** Feature flags and behavioral metadata for the policy */
    features?: {
      /** Whether the policy supports dynamic refresh without browser restart */
      dynamicRefresh?: boolean;
      /** Whether the policy can be applied per user profile */
      perProfile?: boolean;
      /** Whether the policy can be set as 'recommended' (user can override) */
      canBeRecommended?: boolean;
      /** Whether the policy can be set as 'mandatory' (user cannot override) */
      canBeMandatory?: boolean;
      /** Whether the policy is only available via cloud-based admin console */
      cloudOnly?: boolean;
      /** Whether the policy applies only to user-level configurations */
      userOnly?: boolean;
    };
  };
}

// ============================================================================
// UPSTASH VECTOR DATABASE TYPES
// ============================================================================

/**
 * Base metadata interface that all vectors stored in our Upstash Vector database must have.
 * This ensures consistent structure across all document types in the vector store.
 */
export interface BaseVectorMetadata {
  /** Index signature to satisfy Upstash Vector's metadata requirements */
  [key: string]: unknown;
  /** The type/category of document stored in the vector */
  kind: string;
  /** The title of the document */
  title: string;
  /** The source URL of the document */
  url: string;
  /** Timestamp when the document was crawled and indexed */
  crawledAt: Date;
}

/**
 * Metadata structure for policy documents stored in the vector database.
 * Combines base vector metadata with policy-specific information.
 */
export type PolicyVectorMetadata = BaseVectorMetadata &
  PolicyDocument["metadata"];

/**
 * Metadata structure for article documents stored in the vector database.
 * Combines base vector metadata with article-specific information.
 */
export type ArticleVectorMetadata = BaseVectorMetadata &
  NonNullable<Document["metadata"]>;

// ============================================================================
// SEARCH API TYPES
// ============================================================================

/**
 * Generic search result format returned by search tools.
 * Provides a consistent structure for search responses across different document types.
 */
export interface SearchResult {
  /** Unique identifier for the search result */
  resourceId: string;
  /** Ranking position in the search results (1-based) */
  rank: number;
  /** Optional title of the result */
  title?: string;
  /** The content/text of the result */
  content: string;
  /** Similarity score from the vector search (0-1, higher is more similar) */
  score: number;
}

/**
 * Structured search result specifically for Chrome Enterprise policy searches.
 * Provides policy-specific fields for rich display of policy information.
 */
export interface PolicySearchResult {
  /** Unique identifier for the search result */
  resourceId: string;
  /** Ranking position in the search results (1-based) */
  rank: number;
  /** The name of the policy */
  policyName?: string;
  /** The numeric ID of the policy */
  policyId?: number;
  /** Whether the policy is deprecated */
  deprecated?: boolean;
  /** Whether the policy is device-only */
  deviceOnly?: boolean;
  /** Array of supported platforms */
  platforms?: string[];
  /** Array of policy tags */
  tags?: string[];
  /** The policy content/description */
  content: string;
  /** Similarity score from the vector search */
  score: number;
  /** Source URL of the policy documentation */
  url?: string;
}

/**
 * Structured search result specifically for Chrome Enterprise article searches.
 * Provides article-specific fields for rich display of documentation.
 */
export interface ArticleSearchResult {
  /** Unique identifier for the search result */
  resourceId: string;
  /** Ranking position in the search results (1-based) */
  rank: number;
  /** The title of the article */
  title?: string;
  /** The type of article */
  articleType?: string;
  /** The internal article ID */
  articleId?: string;
  /** The article content */
  content: string;
  /** Similarity score from the vector search */
  score: number;
  /** Source URL of the article */
  url?: string;
}

// ============================================================================
// CRAWLER CONFIGURATION CONSTANTS
// ============================================================================

/** Maximum data size allowed by Upstash Vector (1MB) */
export const UPSTASH_MAX_DATA_SIZE = 1024 * 1024;

/** Batch size for processing documents in chunks */
export const BATCH_SIZE = 100;

/** Maximum number of requests to make during crawling */
export const MAX_REQUESTS = 500;

/** Maximum concurrent requests during crawling */
export const MAX_CONCURRENCY = 10;
