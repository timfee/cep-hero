/**
 * Tests for InlineCitation carousel navigation buttons.
 * Validates cursor-pointer and accessibility attributes.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "bun:test";

import {
  InlineCitationCarouselPrev,
  InlineCitationCarouselNext,
} from "./inline-citation";

describe("InlineCitationCarouselPrev", () => {
  it("has cursor-pointer for discoverability", () => {
    const { getByRole } = render(<InlineCitationCarouselPrev />);

    const button = getByRole("button", { name: "Previous" });
    expect(button).toHaveClass("cursor-pointer");
  });

  it("is a button with type=button", () => {
    const { getByRole } = render(<InlineCitationCarouselPrev />);

    const button = getByRole("button", { name: "Previous" });
    expect(button).toHaveAttribute("type", "button");
  });
});

describe("InlineCitationCarouselNext", () => {
  it("has cursor-pointer for discoverability", () => {
    const { getByRole } = render(<InlineCitationCarouselNext />);

    const button = getByRole("button", { name: "Next" });
    expect(button).toHaveClass("cursor-pointer");
  });

  it("is a button with type=button", () => {
    const { getByRole } = render(<InlineCitationCarouselNext />);

    const button = getByRole("button", { name: "Next" });
    expect(button).toHaveAttribute("type", "button");
  });
});
