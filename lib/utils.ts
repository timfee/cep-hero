/**
 * General utility functions shared across the codebase.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with clsx support for conditional classes.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Resolve a required environment variable, throwing if missing.
 */
export function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing ${name} environment variable`);
  }

  return value;
}
