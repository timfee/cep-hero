/**
 * Tests for the authentication loading component.
 * Verifies skeleton structure and animations match the sign-in page layout.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "bun:test";

import AuthLoading from "./loading";

describe("AuthLoading", () => {
  it("renders main element", () => {
    const { container } = render(<AuthLoading />);
    expect(container.querySelector("main")).toBeInTheDocument();
  });

  it("renders logo skeleton", () => {
    const { container } = render(<AuthLoading />);
    expect(
      container.querySelector(".h-14.w-14.animate-pulse")
    ).toBeInTheDocument();
  });

  it("renders button skeleton", () => {
    const { container } = render(<AuthLoading />);
    expect(
      container.querySelector(".h-11.w-full.animate-pulse")
    ).toBeInTheDocument();
  });

  it("uses max-w-sm for layout", () => {
    const { container } = render(<AuthLoading />);
    expect(container.querySelector(".max-w-sm")).toBeInTheDocument();
  });

  it("has skeleton elements with pulse animation", () => {
    const { container } = render(<AuthLoading />);
    const animated = container.querySelectorAll(".animate-pulse");
    expect(animated.length).toBe(4);
  });
});
