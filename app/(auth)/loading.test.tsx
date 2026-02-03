/**
 * Tests for the authentication loading component.
 * Verifies skeleton structure and animations match the sign-in page layout.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "bun:test";

import AuthLoading from "./loading";

describe("AuthLoading component", () => {
  it("renders without crashing", () => {
    const { container } = render(<AuthLoading />);

    const main = container.querySelector("main");
    expect(main).toBeInTheDocument();
  });

  it("renders logo placeholder skeleton", () => {
    const { container } = render(<AuthLoading />);

    const logoPlaceholder = container.querySelector(".h-14.w-14.animate-pulse");
    expect(logoPlaceholder).toBeInTheDocument();
  });

  it("renders card placeholder with border", () => {
    const { container } = render(<AuthLoading />);

    const card = container.querySelector(".rounded-lg.border.border-border");
    expect(card).toBeInTheDocument();
  });

  it("renders button placeholder", () => {
    const { container } = render(<AuthLoading />);

    const buttonPlaceholder = container.querySelector(".h-11.w-full");
    expect(buttonPlaceholder).toBeInTheDocument();
  });

  it("uses max-w-sm for mobile-friendly layout", () => {
    const { container } = render(<AuthLoading />);

    const maxWidth = container.querySelector(".max-w-sm");
    expect(maxWidth).toBeInTheDocument();
  });

  it("has multiple animated skeleton elements", () => {
    const { container } = render(<AuthLoading />);

    const animatedElements = container.querySelectorAll(".animate-pulse");
    expect(animatedElements.length).toBeGreaterThanOrEqual(6);
  });
});
