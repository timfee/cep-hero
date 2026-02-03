import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "bun:test";

import { FixtureProvider, useFixtureContext } from "./context";

describe("FixtureContext", () => {
  it("provides initial state with no active fixture", () => {
    const { result } = renderHook(() => useFixtureContext(), {
      wrapper: FixtureProvider,
    });

    expect(result.current.activeFixture).toBeNull();
    expect(result.current.isFixtureMode).toBe(false);
  });

  it("sets active fixture correctly", () => {
    const { result } = renderHook(() => useFixtureContext(), {
      wrapper: FixtureProvider,
    });

    const mockFixture = {
      id: "EC-001",
      title: "Network connectivity during enrollment",
      category: "enrollment",
      data: {
        auditEvents: {
          items: [{ kind: "test" }],
        },
      },
    };

    act(() => {
      result.current.setActiveFixture(mockFixture);
    });

    expect(result.current.activeFixture).toEqual(mockFixture);
    expect(result.current.isFixtureMode).toBe(true);
  });

  it("clears fixture correctly", () => {
    const { result } = renderHook(() => useFixtureContext(), {
      wrapper: FixtureProvider,
    });

    const mockFixture = {
      id: "EC-001",
      title: "Test",
      category: "test",
      data: {},
    };

    act(() => {
      result.current.setActiveFixture(mockFixture);
    });

    expect(result.current.isFixtureMode).toBe(true);

    act(() => {
      result.current.clearFixture();
    });

    expect(result.current.activeFixture).toBeNull();
    expect(result.current.isFixtureMode).toBe(false);
  });

  it("throws error when used outside provider", () => {
    expect(() => {
      renderHook(() => useFixtureContext());
    }).toThrow("useFixtureContext must be used within a FixtureProvider");
  });
});
