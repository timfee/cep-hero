/**
 * Tests for the OrgUnitDisplay component.
 * Validates both context-free fallback rendering and context-based resolution
 * of org unit IDs to friendly inline name (path) format.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "bun:test";

import { OrgUnitMapProvider, type OrgUnitInfo } from "./org-unit-context";
import { OrgUnitDisplay } from "./org-unit-display";

/**
 * Helper to build a context map and wrap OrgUnitDisplay in the provider.
 */
function renderWithContext(
  props: Parameters<typeof OrgUnitDisplay>[0],
  entries: [string, OrgUnitInfo][]
) {
  const map = new Map<string, OrgUnitInfo>(entries);
  return render(
    <OrgUnitMapProvider map={map}>
      <OrgUnitDisplay {...props} />
    </OrgUnitMapProvider>
  );
}

describe("OrgUnitDisplay", () => {
  describe("without context (fallback behavior)", () => {
    it("extracts leaf name from path and shows path for multi-segment paths", () => {
      const { container } = render(<OrgUnitDisplay name="/Sales/West Coast" />);

      expect(container.textContent).toContain("West Coast");
      expect(container.textContent).toContain("(/Sales/West Coast)");
    });

    it("shows leaf name without path for single-segment paths", () => {
      const { container } = render(<OrgUnitDisplay name="/Engineering" />);

      expect(container.textContent).toContain("Engineering");
      // No path shown — "/Engineering" matches "/${displayName}"
      expect(container.textContent).not.toContain("(");
    });

    it("shows root indicator for orgunits/ without context", () => {
      const { container } = render(
        <OrgUnitDisplay targetResource="orgunits/03ph8a2z23yjui6" />
      );

      expect(container.textContent).toContain("/");
    });

    it("shows non-path name directly", () => {
      const { container } = render(<OrgUnitDisplay name="Engineering" />);

      expect(container.textContent).toContain("Engineering");
      expect(container.textContent).not.toContain("(");
    });

    it("shows Organization for customers/ prefix", () => {
      const { container } = render(
        <OrgUnitDisplay targetResource="customers/C12345" />
      );

      expect(container.textContent).toContain("Organization");
    });

    it("extracts leaf name from targetResource path", () => {
      const { container } = render(
        <OrgUnitDisplay targetResource="/Engineering" />
      );

      expect(container.textContent).toContain("Engineering");
    });

    it("shows original value for unrecognized patterns", () => {
      const { container } = render(
        <OrgUnitDisplay targetResource="some-unknown-format" />
      );

      expect(container.textContent).toContain("some-unknown-format");
    });
  });

  describe("with context (ID resolution)", () => {
    it("resolves org unit ID to name via context", () => {
      const { container } = renderWithContext(
        { targetResource: "orgunits/abc123" },
        [
          ["abc123", { name: "Engineering", path: "/Engineering" }],
          ["orgunits/abc123", { name: "Engineering", path: "/Engineering" }],
        ]
      );

      expect(container.textContent).toContain("Engineering");
    });

    it("resolves nested org unit ID to name with path in parentheses", () => {
      const { container } = renderWithContext(
        { targetResource: "orgunits/xyz789" },
        [["orgunits/xyz789", { name: "West Coast", path: "/Sales/West Coast" }]]
      );

      expect(container.textContent).toContain("West Coast");
      expect(container.textContent).toContain("(/Sales/West Coast)");
    });

    it("resolves bare id prop via context", () => {
      const { container } = renderWithContext({ id: "03ph8a2z23yjui6" }, [
        ["03ph8a2z23yjui6", { name: "Engineering", path: "/Engineering" }],
      ]);

      expect(container.textContent).toContain("Engineering");
    });

    it("prefers explicit name prop over context name", () => {
      const { container } = renderWithContext(
        { name: "Custom Name", id: "abc123" },
        [["abc123", { name: "Engineering", path: "/Engineering" }]]
      );

      expect(container.textContent).toContain("Custom Name");
    });

    it("resolves id: prefix via context", () => {
      const { container } = renderWithContext({ id: "id:abc123" }, [
        ["abc123", { name: "Engineering", path: "/Engineering" }],
      ]);

      expect(container.textContent).toContain("Engineering");
    });
  });

  describe("path display logic", () => {
    it("does not show path when it matches /${displayName}", () => {
      const { container } = render(<OrgUnitDisplay name="/Engineering" />);

      expect(container.textContent).not.toContain("(");
    });

    it("shows path in parentheses for multi-segment paths", () => {
      const { container } = render(<OrgUnitDisplay name="/Sales/West Coast" />);

      expect(container.textContent).toContain("(/Sales/West Coast)");
    });

    it("does not show path when it equals displayName", () => {
      const { container } = render(<OrgUnitDisplay name="Engineering" />);

      expect(container.textContent).not.toContain("(");
    });

    it("does not show path for matching name with id prop", () => {
      const { container } = render(
        <OrgUnitDisplay name="/Engineering" id="/Engineering" />
      );

      expect(container.textContent).not.toContain("(");
    });
  });

  describe("size variants", () => {
    it("applies sm size classes by default", () => {
      const { container } = render(<OrgUnitDisplay name="/Test" />);

      const span = container.querySelector(".text-xs");
      expect(span).toBeTruthy();
    });

    it("applies md size classes when specified", () => {
      const { container } = render(<OrgUnitDisplay name="/Test" size="md" />);

      const span = container.querySelector(".text-sm");
      expect(span).toBeTruthy();
    });
  });

  describe("edge cases", () => {
    it("handles null values gracefully", () => {
      const { container } = render(
        <OrgUnitDisplay name={null} id={null} targetResource={null} />
      );

      expect(container.textContent).toContain("/");
    });

    it("handles empty orgunits/ prefix", () => {
      const { container } = render(
        <OrgUnitDisplay targetResource="orgunits/" />
      );

      expect(container.textContent).toContain("/");
      expect(container.textContent).not.toContain("(");
    });

    it("applies custom className", () => {
      const { container } = render(
        <OrgUnitDisplay name="/Test" className="custom-class" />
      );

      expect(container.querySelector(".custom-class")).toBeTruthy();
    });

    it("handles root path correctly", () => {
      const { container } = render(<OrgUnitDisplay name="/" />);

      expect(container.textContent).toBe("/");
      expect(container.textContent).not.toContain("(");
    });
  });
});
