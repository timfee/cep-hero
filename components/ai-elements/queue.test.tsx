/**
 * Tests for the Queue components.
 * Validates cursor-pointer on collapsible triggers and structure.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "bun:test";

import {
  Queue,
  QueueSection,
  QueueSectionTrigger,
  QueueSectionLabel,
  QueueSectionContent,
  QueueList,
  QueueItem,
  QueueItemContent,
} from "./queue";

describe("QueueSectionTrigger", () => {
  it("has cursor-pointer for discoverability", () => {
    const { getByRole } = render(
      <Queue>
        <QueueSection>
          <QueueSectionTrigger>
            <QueueSectionLabel label="items" count={3} />
          </QueueSectionTrigger>
          <QueueSectionContent>
            <QueueList>
              <QueueItem>
                <QueueItemContent>Task 1</QueueItemContent>
              </QueueItem>
            </QueueList>
          </QueueSectionContent>
        </QueueSection>
      </Queue>
    );

    const button = getByRole("button");
    expect(button).toHaveClass("cursor-pointer");
  });

  it("is a button with type=button", () => {
    const { getByRole } = render(
      <QueueSection>
        <QueueSectionTrigger>Toggle</QueueSectionTrigger>
      </QueueSection>
    );

    const button = getByRole("button");
    expect(button).toHaveAttribute("type", "button");
  });
});
