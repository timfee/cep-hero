/**
 * Tests for the ResizablePanels component.
 * Validates panel rendering, resizing behavior, and keyboard navigation.
 */

import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach } from "bun:test";

import { ResizablePanels, useResizablePanels } from "./resizable-panels";

/**
 * Test component that displays the current panel width from context.
 */
function WidthDisplay() {
  const { leftWidth } = useResizablePanels();
  return <div data-testid="width-display">{Math.round(leftWidth)}</div>;
}

describe("ResizablePanels component", () => {
  const TEST_STORAGE_KEY = "test-resizable-panels";

  beforeEach(() => {
    localStorage.removeItem(TEST_STORAGE_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(TEST_STORAGE_KEY);
  });

  it("renders both children panels", () => {
    const { getByTestId } = render(
      <ResizablePanels storageKey={TEST_STORAGE_KEY}>
        <div data-testid="left-panel">Left Content</div>
        <div data-testid="right-panel">Right Content</div>
      </ResizablePanels>
    );

    expect(getByTestId("left-panel")).toBeInTheDocument();
    expect(getByTestId("right-panel")).toBeInTheDocument();
  });

  it("renders the separator with correct ARIA attributes", () => {
    const { getByRole } = render(
      <ResizablePanels
        storageKey={TEST_STORAGE_KEY}
        defaultLeftWidth={50}
        minLeftWidth={20}
        maxLeftWidth={80}
      >
        <div>Left</div>
        <div>Right</div>
      </ResizablePanels>
    );

    const separator = getByRole("separator");
    expect(separator).toBeInTheDocument();
    expect(separator).toHaveAttribute("aria-orientation", "vertical");
    expect(separator).toHaveAttribute("aria-label", "Resize panels");
    expect(separator).toHaveAttribute("tabIndex", "0");
    expect(separator).toHaveAttribute("aria-valuemin", "20");
    expect(separator).toHaveAttribute("aria-valuemax", "80");
    expect(separator).toHaveAttribute("aria-valuenow", "50");
  });

  it("uses default width when no stored value exists", () => {
    const { getByTestId } = render(
      <ResizablePanels defaultLeftWidth={60} storageKey={TEST_STORAGE_KEY}>
        <WidthDisplay />
        <div>Right</div>
      </ResizablePanels>
    );

    expect(getByTestId("width-display").textContent).toBe("60");
  });

  it("loads stored width from localStorage", () => {
    localStorage.setItem(TEST_STORAGE_KEY, "45");

    const { getByTestId } = render(
      <ResizablePanels defaultLeftWidth={60} storageKey={TEST_STORAGE_KEY}>
        <WidthDisplay />
        <div>Right</div>
      </ResizablePanels>
    );

    expect(getByTestId("width-display").textContent).toBe("45");
  });

  it("ignores stored width outside valid range", () => {
    localStorage.setItem(TEST_STORAGE_KEY, "95"); // Outside maxLeftWidth of 80

    const { getByTestId } = render(
      <ResizablePanels
        defaultLeftWidth={50}
        minLeftWidth={20}
        maxLeftWidth={80}
        storageKey={TEST_STORAGE_KEY}
      >
        <WidthDisplay />
        <div>Right</div>
      </ResizablePanels>
    );

    // Should fall back to default since 95 > maxLeftWidth
    expect(getByTestId("width-display").textContent).toBe("50");
  });

  it("handles keyboard navigation with ArrowLeft", () => {
    const { getByTestId, getByRole } = render(
      <ResizablePanels
        defaultLeftWidth={50}
        minLeftWidth={20}
        maxLeftWidth={80}
        storageKey={TEST_STORAGE_KEY}
      >
        <WidthDisplay />
        <div>Right</div>
      </ResizablePanels>
    );

    const separator = getByRole("separator");
    fireEvent.keyDown(separator, { key: "ArrowLeft" });

    expect(getByTestId("width-display").textContent).toBe("49");
  });

  it("handles keyboard navigation with ArrowRight", () => {
    const { getByTestId, getByRole } = render(
      <ResizablePanels
        defaultLeftWidth={50}
        minLeftWidth={20}
        maxLeftWidth={80}
        storageKey={TEST_STORAGE_KEY}
      >
        <WidthDisplay />
        <div>Right</div>
      </ResizablePanels>
    );

    const separator = getByRole("separator");
    fireEvent.keyDown(separator, { key: "ArrowRight" });

    expect(getByTestId("width-display").textContent).toBe("51");
  });

  it("respects minimum width on keyboard navigation", () => {
    const { getByTestId, getByRole } = render(
      <ResizablePanels
        defaultLeftWidth={21}
        minLeftWidth={20}
        maxLeftWidth={80}
        storageKey={TEST_STORAGE_KEY}
      >
        <WidthDisplay />
        <div>Right</div>
      </ResizablePanels>
    );

    const separator = getByRole("separator");
    fireEvent.keyDown(separator, { key: "ArrowLeft" });
    fireEvent.keyDown(separator, { key: "ArrowLeft" });

    // Should stop at minLeftWidth
    expect(getByTestId("width-display").textContent).toBe("20");
  });

  it("respects maximum width on keyboard navigation", () => {
    const { getByTestId, getByRole } = render(
      <ResizablePanels
        defaultLeftWidth={79}
        minLeftWidth={20}
        maxLeftWidth={80}
        storageKey={TEST_STORAGE_KEY}
      >
        <WidthDisplay />
        <div>Right</div>
      </ResizablePanels>
    );

    const separator = getByRole("separator");
    fireEvent.keyDown(separator, { key: "ArrowRight" });
    fireEvent.keyDown(separator, { key: "ArrowRight" });

    // Should stop at maxLeftWidth
    expect(getByTestId("width-display").textContent).toBe("80");
  });

  it("applies custom className to container", () => {
    const { container } = render(
      <ResizablePanels className="custom-class" storageKey={TEST_STORAGE_KEY}>
        <div>Left</div>
        <div>Right</div>
      </ResizablePanels>
    );

    const panelContainer = container.firstChild;
    expect(panelContainer).toHaveClass("custom-class");
  });

  it("starts drag on mouseDown", () => {
    const { getByRole } = render(
      <ResizablePanels storageKey={TEST_STORAGE_KEY}>
        <div>Left</div>
        <div>Right</div>
      </ResizablePanels>
    );

    const separator = getByRole("separator");
    fireEvent.mouseDown(separator);

    // The container should have select-none class during drag
    const container = separator.parentElement;
    expect(container).toHaveClass("select-none");
  });

  it("provides context values to children", () => {
    /**
     * Component that displays both context values.
     */
    function ContextDisplay() {
      const { leftWidth, isDragging } = useResizablePanels();
      return (
        <div>
          <span data-testid="ctx-width">{Math.round(leftWidth)}</span>
          <span data-testid="ctx-dragging">{String(isDragging)}</span>
        </div>
      );
    }

    const { getByTestId } = render(
      <ResizablePanels defaultLeftWidth={55} storageKey={TEST_STORAGE_KEY}>
        <ContextDisplay />
        <div>Right</div>
      </ResizablePanels>
    );

    expect(getByTestId("ctx-width").textContent).toBe("55");
    expect(getByTestId("ctx-dragging").textContent).toBe("false");
  });
});
