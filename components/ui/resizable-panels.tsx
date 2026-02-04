/**
 * Resizable two-panel layout component with a draggable splitter.
 * Provides smooth resize interactions and persists panel sizes.
 */

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

/**
 * Context value for resizable panels state.
 */
interface ResizablePanelsContextValue {
  leftWidth: number;
  isDragging: boolean;
}

const ResizablePanelsContext = createContext<ResizablePanelsContextValue>({
  leftWidth: 50,
  isDragging: false,
});

/**
 * Hook to access resizable panels context.
 */
export function useResizablePanels() {
  return useContext(ResizablePanelsContext);
}

/**
 * Props for the ResizablePanels component.
 */
interface ResizablePanelsProps {
  children: React.ReactNode;
  defaultLeftWidth?: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  storageKey?: string;
  className?: string;
}

/**
 * A two-panel layout with a draggable splitter between them.
 * Children should be two elements: left panel and right panel.
 */
export function ResizablePanels({
  children,
  defaultLeftWidth = 50,
  minLeftWidth = 20,
  maxLeftWidth = 80,
  storageKey = "resizable-panels-width",
  className,
}: ResizablePanelsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftWidthRef = useRef(defaultLeftWidth);
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isDragging, setIsDragging] = useState(false);

  // Keep ref in sync with state for use in event handlers
  useEffect(() => {
    leftWidthRef.current = leftWidth;
  }, [leftWidth]);

  // Load stored width from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= minLeftWidth && parsed <= maxLeftWidth) {
        setLeftWidth(parsed);
      }
    }
  }, [storageKey, minLeftWidth, maxLeftWidth]);

  /**
   * Save the current width to localStorage.
   */
  const saveWidth = useCallback(() => {
    localStorage.setItem(storageKey, leftWidthRef.current.toString());
  }, [storageKey]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  // Handle mouse move and up during drag
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(maxLeftWidth, Math.max(minLeftWidth, newWidth));
      setLeftWidth(clamped);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // Use ref to get the latest value, avoiding stale closure
      saveWidth();
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, maxLeftWidth, minLeftWidth, saveWidth]);

  /**
   * Handle keyboard navigation for accessibility.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let newWidth = leftWidth;

      if (e.key === "ArrowLeft") {
        newWidth = Math.max(minLeftWidth, leftWidth - 1);
      } else if (e.key === "ArrowRight") {
        newWidth = Math.min(maxLeftWidth, leftWidth + 1);
      } else {
        return;
      }

      setLeftWidth(newWidth);
      // Persist keyboard adjustments
      leftWidthRef.current = newWidth;
      saveWidth();
    },
    [leftWidth, maxLeftWidth, minLeftWidth, saveWidth]
  );

  const childArray = Array.isArray(children) ? children : [children];
  const leftChild = childArray[0];
  const rightChild = childArray[1];

  return (
    <ResizablePanelsContext.Provider value={{ leftWidth, isDragging }}>
      <div
        ref={containerRef}
        className={cn(
          "flex h-full overflow-hidden",
          isDragging && "select-none",
          className
        )}
      >
        <div
          className="flex h-full flex-col overflow-hidden"
          style={{ width: `${leftWidth}%` }}
        >
          {leftChild}
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panels"
          aria-valuemin={minLeftWidth}
          aria-valuemax={maxLeftWidth}
          aria-valuenow={Math.round(leftWidth)}
          tabIndex={0}
          className="relative z-10 w-px shrink-0 cursor-col-resize bg-transparent"
          onMouseDown={handleMouseDown}
          onKeyDown={handleKeyDown}
        />

        <div className="flex h-full flex-1 flex-col overflow-hidden">
          {rightChild}
        </div>
      </div>
    </ResizablePanelsContext.Provider>
  );
}
