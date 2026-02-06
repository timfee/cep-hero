/**
 * Shared types for fixture API routes.
 */

/**
 * A single case entry from the eval registry.
 */
export interface RegistryCase {
  id: string;
  title: string;
  category: string;
  tags?: string[];
  overrides?: string[];
}

/**
 * The full eval registry structure loaded from disk.
 */
export interface Registry {
  version: string;
  cases: RegistryCase[];
}
