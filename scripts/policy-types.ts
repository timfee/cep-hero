/**
 * Type definitions and utility functions for Chrome Enterprise policy templates.
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
 * JSON Schema structure for policy value validation and documentation.
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
 * A selectable option within an enum-type policy.
 */
export interface Item {
  caption: string;
  value: string | number | boolean | null;
  name?: string;
  supported_on?: string[];
}

/**
 * Feature flags describing policy behavior characteristics.
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
 * Parse a single supported_on string into human-readable format.
 */
export function parseSupportString(supportString: string) {
  const [platform, versions] = supportString.split(":");

  if (!versions) {
    return PLATFORM_MAP[platform] || platform;
  }

  const [startVersion, endVersion] = versions.split("-");
  const platformName = PLATFORM_MAP[platform] || platform;

  if (endVersion === "") {
    return `${platformName} version ${startVersion} and later`;
  } else if (endVersion) {
    return `${platformName} versions ${startVersion} to ${endVersion}`;
  }
  return `${platformName} version ${startVersion}`;
}

/**
 * Convert the supported_on array to a human-readable string.
 */
export function getSupportedOnText(policy: PolicyDefinition) {
  if (!Array.isArray(policy.supported_on) || policy.supported_on.length === 0) {
    return "Not specified";
  }
  return policy.supported_on.map(parseSupportString).join(", ");
}
