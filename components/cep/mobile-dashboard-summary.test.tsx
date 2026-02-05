/**
 * Tests for the MobileDashboardSummary component.
 * Validates collapsed/expanded states and interaction behavior.
 */

import { render, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, mock, afterEach } from "bun:test";

/**
 * Dashboard data structure for mock SWR responses.
 */
interface MockDashboardData {
  headline: string;
  summary: string;
  postureCards: Array<{
    label: string;
    value: string;
    note: string;
    source: string;
    action: string;
    status: string;
    priority: number;
  }>;
  suggestions: Array<{
    text: string;
    action: string;
    priority: number;
    category: string;
  }>;
  sources: string[];
}

/**
 * Mock SWR return type for dashboard tests.
 */
interface MockSWRReturn {
  data: MockDashboardData | null;
  error: Error | null;
  isLoading: boolean;
  isValidating: boolean;
  mutate: typeof mockMutate;
}

// Mock useSWR
const mockMutate = mock(() => Promise.resolve());
let mockSWRReturn: MockSWRReturn = {
  data: null,
  error: null,
  isLoading: true,
  isValidating: false,
  mutate: mockMutate,
};

mock.module("swr", () => ({
  default: () => mockSWRReturn,
}));

import { MobileDashboardSummary } from "./mobile-dashboard-summary";

describe("MobileDashboardSummary component", () => {
  const mockOnAction = mock(() => {});

  afterEach(() => {
    mockOnAction.mockClear();
    mockMutate.mockClear();
  });

  it("shows loading shimmer during initial load", () => {
    mockSWRReturn = {
      data: null,
      error: null,
      isLoading: true,
      isValidating: false,
      mutate: mockMutate,
    };

    const { getByText } = render(
      <MobileDashboardSummary onAction={mockOnAction} />
    );

    expect(getByText("Analyzing fleet...")).toBeInTheDocument();
  });

  it("shows headline when data is loaded", async () => {
    mockSWRReturn = {
      data: {
        headline: "Your fleet is secure",
        summary: "All systems operating normally.",
        postureCards: [
          {
            label: "Managed Devices",
            value: "150",
            note: "All devices enrolled",
            source: "Chrome API",
            action: "Show managed devices",
            status: "healthy",
            priority: 1,
          },
        ],
        suggestions: [],
        sources: [],
      },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    };

    const { getByText } = render(
      <MobileDashboardSummary onAction={mockOnAction} />
    );

    await waitFor(() => {
      expect(getByText("Your fleet is secure")).toBeInTheDocument();
    });
  });

  it("shows status pills for top posture cards", async () => {
    mockSWRReturn = {
      data: {
        headline: "Fleet Status",
        summary: "Some attention needed.",
        postureCards: [
          {
            label: "Security Events",
            value: "5",
            note: "Events detected",
            source: "Chrome API",
            action: "Show events",
            status: "warning",
            priority: 1,
          },
          {
            label: "Managed Devices",
            value: "150",
            note: "All enrolled",
            source: "Chrome API",
            action: "Show devices",
            status: "healthy",
            priority: 2,
          },
        ],
        suggestions: [],
        sources: [],
      },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    };

    const { getByText } = render(
      <MobileDashboardSummary onAction={mockOnAction} />
    );

    await waitFor(() => {
      // Status pills should show values
      expect(getByText("5")).toBeInTheDocument();
      expect(getByText("150")).toBeInTheDocument();
    });
  });

  it("expands to show full content when header is clicked", async () => {
    mockSWRReturn = {
      data: {
        headline: "Fleet Status",
        summary: "All systems are operating normally with no issues detected.",
        postureCards: [
          {
            label: "Security Events",
            value: "0",
            note: "No events",
            source: "Chrome API",
            action: "Show events",
            status: "healthy",
            priority: 1,
          },
        ],
        suggestions: [
          {
            text: "Enable DLP monitoring",
            action: "Help me set up DLP",
            priority: 1,
            category: "security",
          },
        ],
        sources: [],
      },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    };

    const { getByText, getByRole, queryByText } = render(
      <MobileDashboardSummary onAction={mockOnAction} />
    );

    // Summary should not be visible initially (collapsed)
    expect(
      queryByText("All systems are operating normally with no issues detected.")
    ).not.toBeInTheDocument();

    // Click to expand
    const headerButton = getByRole("button", { name: /Fleet Status/i });
    fireEvent.click(headerButton);

    // Now summary and details should be visible
    await waitFor(() => {
      expect(
        getByText("All systems are operating normally with no issues detected.")
      ).toBeInTheDocument();
      expect(getByText("Fleet posture")).toBeInTheDocument();
      expect(getByText("Security Events")).toBeInTheDocument();
      expect(getByText("Top recommendation")).toBeInTheDocument();
      expect(getByText("Enable DLP monitoring")).toBeInTheDocument();
    });
  });

  it("collapses when header is clicked again", async () => {
    mockSWRReturn = {
      data: {
        headline: "Fleet Status",
        summary: "Summary text here.",
        postureCards: [],
        suggestions: [],
        sources: [],
      },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    };

    const { getByRole, getByText, container } = render(
      <MobileDashboardSummary onAction={mockOnAction} />
    );

    // Click to expand
    const headerButton = getByRole("button", { name: /Fleet Status/i });
    fireEvent.click(headerButton);

    await waitFor(() => {
      expect(getByText("Summary text here.")).toBeInTheDocument();
    });

    // Check chevron is rotated (expanded state)
    const chevronExpanded = container.querySelector(".rotate-180");
    expect(chevronExpanded).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(headerButton);

    // After collapse, chevron should no longer be rotated
    // (animation handles the content removal)
    await waitFor(() => {
      const chevronCollapsed = container.querySelector(".rotate-180");
      expect(chevronCollapsed).not.toBeInTheDocument();
    });
  });

  it("triggers onAction when posture card is clicked", async () => {
    mockSWRReturn = {
      data: {
        headline: "Fleet Status",
        summary: "Some summary.",
        postureCards: [
          {
            label: "Security Events",
            value: "5",
            note: "Review needed",
            source: "Chrome API",
            action: "Show security events",
            status: "warning",
            priority: 1,
          },
        ],
        suggestions: [],
        sources: [],
      },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    };

    const { getByRole, getByText } = render(
      <MobileDashboardSummary onAction={mockOnAction} />
    );

    // Expand first
    const headerButton = getByRole("button", { name: /Fleet Status/i });
    fireEvent.click(headerButton);

    await waitFor(() => {
      expect(getByText("Security Events")).toBeInTheDocument();
    });

    // Click the posture card
    const postureCard = getByText("Security Events").closest("button");
    if (postureCard) {
      fireEvent.click(postureCard);
    }

    expect(mockOnAction).toHaveBeenCalledWith("Show security events");
  });

  it("triggers onAction when top recommendation is clicked", async () => {
    mockSWRReturn = {
      data: {
        headline: "Fleet Status",
        summary: "Some summary.",
        postureCards: [],
        suggestions: [
          {
            text: "Enable DLP monitoring",
            action: "Help me set up DLP",
            priority: 1,
            category: "security",
          },
          {
            text: "Review policies",
            action: "Show policies",
            priority: 2,
            category: "compliance",
          },
        ],
        sources: [],
      },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    };

    const { getByRole, getByText } = render(
      <MobileDashboardSummary onAction={mockOnAction} />
    );

    // Expand first
    const headerButton = getByRole("button", { name: /Fleet Status/i });
    fireEvent.click(headerButton);

    await waitFor(() => {
      expect(getByText("Enable DLP monitoring")).toBeInTheDocument();
    });

    // Click the recommendation
    const recommendationCard = getByText("Enable DLP monitoring").closest(
      "button"
    );
    if (recommendationCard) {
      fireEvent.click(recommendationCard);
    }

    expect(mockOnAction).toHaveBeenCalledWith("Help me set up DLP");
  });

  it("shows correct status indicator color based on posture", async () => {
    mockSWRReturn = {
      data: {
        headline: "Issues Detected",
        summary: "Critical issues found.",
        postureCards: [
          {
            label: "Critical Issue",
            value: "1",
            note: "Needs attention",
            source: "Chrome API",
            action: "Show issue",
            status: "critical",
            priority: 1,
          },
        ],
        suggestions: [],
        sources: [],
      },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    };

    const { container } = render(
      <MobileDashboardSummary onAction={mockOnAction} />
    );

    // Check for red status dot (critical)
    const statusDot = container.querySelector(".bg-red-400");
    expect(statusDot).toBeInTheDocument();
  });

  it("shows green status dot when all healthy", async () => {
    mockSWRReturn = {
      data: {
        headline: "All Clear",
        summary: "No issues.",
        postureCards: [
          {
            label: "Status",
            value: "OK",
            note: "All good",
            source: "Chrome API",
            action: "Show status",
            status: "healthy",
            priority: 1,
          },
        ],
        suggestions: [],
        sources: [],
      },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    };

    const { container } = render(
      <MobileDashboardSummary onAction={mockOnAction} />
    );

    // Check for green status dot (healthy)
    const statusDot = container.querySelector(".bg-emerald-400");
    expect(statusDot).toBeInTheDocument();
  });

  it("shows amber status dot when there are warnings", async () => {
    mockSWRReturn = {
      data: {
        headline: "Attention Needed",
        summary: "Some warnings.",
        postureCards: [
          {
            label: "Warning",
            value: "3",
            note: "Review needed",
            source: "Chrome API",
            action: "Show warnings",
            status: "warning",
            priority: 1,
          },
        ],
        suggestions: [],
        sources: [],
      },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    };

    const { container } = render(
      <MobileDashboardSummary onAction={mockOnAction} />
    );

    // Check for amber status dot (warning)
    const statusDot = container.querySelector(".bg-amber-400");
    expect(statusDot).toBeInTheDocument();
  });

  it("shows error message when API fails", () => {
    mockSWRReturn = {
      data: null,
      error: new Error("Network error"),
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    };

    const { getByText } = render(
      <MobileDashboardSummary onAction={mockOnAction} />
    );

    expect(getByText("Unable to load fleet status")).toBeInTheDocument();
  });

  it("has aria-expanded attribute for accessibility", async () => {
    mockSWRReturn = {
      data: {
        headline: "Fleet Status",
        summary: "Summary.",
        postureCards: [],
        suggestions: [],
        sources: [],
      },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    };

    const { getByRole } = render(
      <MobileDashboardSummary onAction={mockOnAction} />
    );

    const headerButton = getByRole("button", { name: /Fleet Status/i });

    // Initially collapsed
    expect(headerButton).toHaveAttribute("aria-expanded", "false");

    // Click to expand
    fireEvent.click(headerButton);

    // Now expanded
    expect(headerButton).toHaveAttribute("aria-expanded", "true");
  });

  it("uses category-specific colors for recommendation badge", async () => {
    mockSWRReturn = {
      data: {
        headline: "Fleet Status",
        summary: "Summary.",
        postureCards: [],
        suggestions: [
          {
            text: "Review compliance policies",
            action: "Show policies",
            priority: 1,
            category: "compliance",
          },
        ],
        sources: [],
      },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    };

    const { getByRole, container } = render(
      <MobileDashboardSummary onAction={mockOnAction} />
    );

    // Expand to see recommendation
    const headerButton = getByRole("button", { name: /Fleet Status/i });
    fireEvent.click(headerButton);

    await waitFor(() => {
      // Compliance category should use amber colors
      const badgeWithAmber = container.querySelector(".bg-amber-500\\/20");
      expect(badgeWithAmber).toBeInTheDocument();
    });
  });
});
