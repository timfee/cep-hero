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

    // SkeletonShimmer uses overflow-hidden class for the shimmer effect
    const cardSkeletons = container.querySelectorAll(
      "section .space-y-3 .overflow-hidden"
    );
    expect(cardSkeletons.length).toBe(3);
  });

  it("uses SkeletonShimmer components for loading animation", () => {
    const { container } = render(<DashboardSkeleton />);

    // SkeletonShimmer uses overflow-hidden and bg-muted/50 classes
    const shimmerElements = container.querySelectorAll(".overflow-hidden");
    expect(shimmerElements.length).toBeGreaterThan(0);
  });

  it("has proper container structure with max-width", () => {
    const { container } = render(<DashboardSkeleton />);

    const innerContainer = container.querySelector(".mx-auto.max-w-3xl");
    expect(innerContainer).toBeInTheDocument();
  });

  it("renders summary line skeletons", () => {
    const { container } = render(<DashboardSkeleton />);

    // There should be multiple shimmer elements in the summary area (mt-5 space-y-3)
    const summaryArea = container.querySelector(".mt-5.space-y-3");
    expect(summaryArea).toBeInTheDocument();

    const summaryShimmers = summaryArea?.querySelectorAll(".overflow-hidden");
    expect(summaryShimmers?.length).toBe(3);
  });
});
