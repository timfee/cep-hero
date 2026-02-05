/**
 * Tests for the OrgUnitDisplay component.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "bun:test";

import { OrgUnitDisplay } from "./org-unit-display";

describe("OrgUnitDisplay", () => {
  describe("name and ID display", () => {
    it("renders name and ID pill when both provided", () => {
      const { container } = render(
        <OrgUnitDisplay name="/Engineering" id="03ph8a2z23yjui6" />
      );

      expect(container.textContent).toContain("/Engineering");
      expect(container.textContent).toContain("03ph8a2z23yjui6");
    });

    it("renders only name when ID not provided", () => {
      const { container } = render(<OrgUnitDisplay name="/Sales" />);

      expect(container.textContent).toContain("/Sales");
      // Should only have one span with text content
      const spans = container.querySelectorAll("span");
      expect(spans.length).toBe(2); // Wrapper + name span
    });

    it("renders root indicator when no name provided", () => {
      const { container } = render(
        <OrgUnitDisplay targetResource="orgunits/03ph8a2z23yjui6" />
      );

      expect(container.textContent).toContain("/");
      expect(container.textContent).toContain("03ph8a2z23yjui6");
    });
  });

  describe("ID extraction from various formats", () => {
    it("extracts ID from orgunits/ prefix", () => {
      const { container } = render(
        <OrgUnitDisplay targetResource="orgunits/abc123" />
      );

      expect(container.textContent).toContain("abc123");
    });

    it("extracts ID from id: prefix", () => {
      const { container } = render(<OrgUnitDisplay id="id:xyz789" />);

      expect(container.textContent).toContain("xyz789");
    });

    it("uses bare alphanumeric string as ID", () => {
      const { container } = render(<OrgUnitDisplay id="simple123" />);

      expect(container.textContent).toContain("simple123");
    });

    it("does not treat path as ID", () => {
      const { container } = render(
        <OrgUnitDisplay name="/Engineering" id="/Engineering" />
      );

      // Should show name only, not duplicate as ID pill
      const pillSpans = container.querySelectorAll(".bg-muted");
      expect(pillSpans.length).toBe(0);
    });
  });

  describe("display name formatting", () => {
    it("shows Organization for customers/ prefix", () => {
      const { container } = render(
        <OrgUnitDisplay targetResource="customers/C12345" />
      );

      expect(container.textContent).toContain("Organization");
    });

    it("preserves path when provided as name", () => {
      const { container } = render(<OrgUnitDisplay name="/Sales/West Coast" />);

      expect(container.textContent).toContain("/Sales/West Coast");
    });

    it("uses targetResource path directly", () => {
      const { container } = render(
        <OrgUnitDisplay targetResource="/Engineering" />
      );

      expect(container.textContent).toContain("/Engineering");
    });
  });

  describe("size variants", () => {
    it("applies sm size classes by default", () => {
      const { container } = render(<OrgUnitDisplay name="/Test" />);

      const nameSpan = container.querySelector(".text-xs");
      expect(nameSpan).toBeTruthy();
    });

    it("applies md size classes when specified", () => {
      const { container } = render(<OrgUnitDisplay name="/Test" size="md" />);

      const nameSpan = container.querySelector(".text-sm");
      expect(nameSpan).toBeTruthy();
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
      // Should not have an ID pill with empty content
      const pillSpans = container.querySelectorAll(".bg-muted");
      expect(pillSpans.length).toBe(0);
    });

    it("applies custom className", () => {
      const { container } = render(
        <OrgUnitDisplay name="/Test" className="custom-class" />
      );

      expect(container.querySelector(".custom-class")).toBeTruthy();
    });
  });
});
