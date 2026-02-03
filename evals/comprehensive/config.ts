/**
 * Configuration for different eval run modes.
 */

import { type RunConfiguration, type RunMode } from "./types";

export const RUN_CONFIGURATIONS: RunConfiguration[] = [
  {
    mode: "fixture-with-judge",
    name: "Fixture Mode + LLM Judge",
    description:
      "Uses fixture data for deterministic results with LLM-as-judge for semantic evaluation",
    env: {
      EVAL_USE_BASE: "1",
      EVAL_USE_FIXTURES: "1",
      EVAL_LLM_JUDGE: "1",
      EVAL_SERIAL: "1",
    },
  },
  {
    mode: "fixture-without-judge",
    name: "Fixture Mode (No Judge)",
    description:
      "Uses fixture data for deterministic results with string-matching only",
    env: {
      EVAL_USE_BASE: "1",
      EVAL_USE_FIXTURES: "1",
      EVAL_LLM_JUDGE: "0",
      EVAL_SERIAL: "1",
    },
  },
  {
    mode: "live-with-judge",
    name: "Live Mode + LLM Judge",
    description:
      "Uses real Google API calls with LLM-as-judge for semantic evaluation",
    env: {
      EVAL_USE_BASE: "0",
      EVAL_USE_FIXTURES: "0",
      EVAL_LLM_JUDGE: "1",
      EVAL_SERIAL: "1",
    },
  },
  {
    mode: "live-without-judge",
    name: "Live Mode (No Judge)",
    description: "Uses real Google API calls with string-matching only",
    env: {
      EVAL_USE_BASE: "0",
      EVAL_USE_FIXTURES: "0",
      EVAL_LLM_JUDGE: "0",
      EVAL_SERIAL: "1",
    },
  },
];

export function getConfigurationByMode(mode: RunMode): RunConfiguration {
  const config = RUN_CONFIGURATIONS.find((c) => c.mode === mode);
  if (!config) {
    throw new Error(`Unknown run mode: ${mode}`);
  }
  return config;
}

export function getDefaultModes(): RunMode[] {
  return ["fixture-with-judge", "fixture-without-judge"];
}

export function getAllModes(): RunMode[] {
  return RUN_CONFIGURATIONS.map((c) => c.mode);
}

export const DEFAULT_ITERATIONS = 1;
export const DEFAULT_OUTPUT_DIR = "evals/comprehensive/reports";
export const GEMINI_ANALYSIS_MODEL = "gemini-2.5-pro-preview-05-06";
