/**
 * Tests for the DashboardSkeleton component.
 * Verifies skeleton structure matches DashboardOverview layout expectations.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "bun:test";

import { DashboardSkeleton } from "./dashboard-skeleton";

describe("DashboardSkeleton component", () => {
  it("renders without crashing", () => {
    const { container } = render(<DashboardSkeleton />);

    const scrollable = container.querySelector(".h-full.overflow-y-auto");
    expect(scrollable).toBeInTheDocument();
  });

  it("renders header skeleton elements", () => {
    const { container } = render(<DashboardSkeleton />);

    const header = container.querySelector("header");
    expect(header).toBeInTheDocument();
  });

  it("renders section skeleton elements", () => {
    const { container } = render(<DashboardSkeleton />);

    const section = container.querySelector("section");
    expect(section).toBeInTheDocument();
  });

  it("renders three card skeleton placeholders", () => {
    const { container } = render(<DashboardSkeleton />);

    const cardSkeletons = container.querySelectorAll(".h-24.animate-pulse");
    expect(cardSkeletons.length).toBe(3);
  });

  it("applies animation delays to card skeletons", () => {
    const { container } = render(<DashboardSkeleton />);

    const cardSkeletons = container.querySelectorAll(
      ".h-24.animate-pulse.rounded-2xl"
    );

    expect(cardSkeletons[0]).toHaveStyle({ animationDelay: "0ms" });
    expect(cardSkeletons[1]).toHaveStyle({ animationDelay: "100ms" });
    expect(cardSkeletons[2]).toHaveStyle({ animationDelay: "200ms" });
  });

  it("uses animate-pulse class for loading animation", () => {
    const { container } = render(<DashboardSkeleton />);

    const animatedElements = container.querySelectorAll(".animate-pulse");
    expect(animatedElements.length).toBeGreaterThan(0);
  });

  it("has proper container structure with max-width", () => {
    const { container } = render(<DashboardSkeleton />);

    const innerContainer = container.querySelector(".mx-auto.max-w-3xl");
    expect(innerContainer).toBeInTheDocument();
  });
});
