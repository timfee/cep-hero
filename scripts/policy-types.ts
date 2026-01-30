/**
 * @file This file contains the TypeScript type definitions for parsing and
 * handling Chrome Enterprise policy templates. The types are structured to
 * match the `policy_templates_en-US.json` schema and are enriched with
 * descriptive comments to aid an LLM or developer in understanding the purpose
 * of each field for tasks like generating Markdown documentation.
 */

/**
 * Represents the semantic user interaction model for a policy.
 * This provides a more abstract and UI-friendly classification than the raw
 * data types (like 'main', 'int-enum', 'string-enum-list') found in the
 * original schema. It groups policies by how a user would interact with them,
 * making it easier to map a policy to a UI component.
 *
 * @enum {string}
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
   * @see PolicyType
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

/**
 * A mapping of platform codes from the policy schema to human-readable names.
 */
const PLATFORM_MAP: Record<string, string> = {
  chrome_os: "ChromeOS",
  "chrome.win": "Google Chrome on Windows",
  "chrome.mac": "Google Chrome on macOS",
  "chrome.linux": "Google Chrome on Linux",
  "chrome.*": "Google Chrome on Windows/macOS/Linux",
  android: "Google Chrome on Android",
  ios: "Google Chrome on iOS",
  webview_android: "Android WebView",
  chrome_frame: "Google Chrome Frame",
  fuchsia: "Google Chrome on Fuchsia",
};

/**
 * Parses a single `supported_on` string (e.g., "chrome_os:81-") into a
 * human-readable format.
 *
 * @param {string} supportString - The raw support string from the policy definition.
 * @returns {string} A human-readable description of platform support.
 */
export function parseSupportString(supportString: string): string {
  const [platform, versions] = supportString.split(":");

  if (!versions) {
    return PLATFORM_MAP[platform] || platform;
  }

  const [startVersion, endVersion] = versions.split("-");
  const platformName = PLATFORM_MAP[platform] || platform;

  if (endVersion === "") {
    // Handles ranges like "81-"
    return `${platformName} version ${startVersion} and later`;
  } else if (endVersion) {
    // Handles ranges like "10-87"
    return `${platformName} versions ${startVersion} to ${endVersion}`;
  } else {
    // Handles a single version number, though this is rare in the data.
    return `${platformName} version ${startVersion}`;
  }
}

/**
 * Converts the entire `supported_on` array from a policy definition into a
 * single, comma-separated human-readable string.
 *
 * @param {PolicyDefinition} policy - The policy definition object.
 * @returns {string} A comprehensive string detailing support, or "Not specified".
 */
export function getSupportedOnText(policy: PolicyDefinition): string {
  if (!policy.supported_on || policy.supported_on.length === 0) {
    return "Not specified";
  }
  return policy.supported_on.map(parseSupportString).join(", ");
}
