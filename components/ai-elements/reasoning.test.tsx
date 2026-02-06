/**
 * Tests for the Reasoning components.
 * Validates cursor-pointer on the collapsible trigger and structure.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "bun:test";

import { Reasoning, ReasoningTrigger, ReasoningContent } from "./reasoning";

describe("ReasoningTrigger", () => {
  it("has cursor-pointer for discoverability", () => {
    const { getByRole } = render(
      <Reasoning>
        <ReasoningTrigger />
        <ReasoningContent>Thinking about the problem...</ReasoningContent>
      </Reasoning>
    );

    const trigger = getByRole("button");
    expect(trigger).toHaveClass("cursor-pointer");
  });

  it("shows reasoning status text", () => {
    const { getByText } = render(
      <Reasoning>
        <ReasoningTrigger />
        <ReasoningContent>Details here</ReasoningContent>
      </Reasoning>
    );

    expect(getByText("Reasoning")).toBeInTheDocument();
  });
});
