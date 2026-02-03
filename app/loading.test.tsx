import { render } from "@testing-library/react";
import { describe, expect, it } from "bun:test";

import Loading from "./loading";

describe("Loading component", () => {
  it("renders loading text", () => {
    const { getByText } = render(<Loading />);

    expect(getByText("Loading...")).toBeInTheDocument();
  });

  it("renders three animated dots", () => {
    const { container } = render(<Loading />);

    const dots = container.querySelectorAll(".h-2.w-2.animate-pulse");
    expect(dots.length).toBe(3);
  });

  it("applies staggered animation delays to dots", () => {
    const { container } = render(<Loading />);

    const dots = container.querySelectorAll(".h-2.w-2.animate-pulse");

    expect(dots[0]).toHaveStyle({ animationDelay: "0ms" });
    expect(dots[1]).toHaveStyle({ animationDelay: "150ms" });
    expect(dots[2]).toHaveStyle({ animationDelay: "300ms" });
  });

  it("centers content on screen", () => {
    const { container } = render(<Loading />);

    const centered = container.querySelector(
      ".flex.h-screen.w-full.items-center.justify-center"
    );
    expect(centered).toBeInTheDocument();
  });
});
