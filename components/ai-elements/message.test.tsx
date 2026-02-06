/**
 * Tests for the Message components.
 * Validates text wrapping, layout constraints, and rendering behavior.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "bun:test";

import { Message, MessageContent, MessageResponse } from "./message";

describe("MessageResponse", () => {
  it("applies overflow-wrap: anywhere for text wrapping", () => {
    const { container } = render(<MessageResponse>Some text</MessageResponse>);

    const streamdown = container.firstElementChild;
    expect(streamdown).toBeInTheDocument();
    expect(streamdown?.className).toMatch(/overflow-wrap/);
  });
});

describe("MessageContent", () => {
  it("constrains width with min-w-0 and max-w-full for flex wrapping", () => {
    const { container } = render(<MessageContent>Content</MessageContent>);

    const el = container.firstElementChild;
    expect(el).toHaveClass("min-w-0");
    expect(el).toHaveClass("max-w-full");
    expect(el).toHaveClass("overflow-hidden");
  });
});

describe("Message", () => {
  it("constrains assistant messages to 95% width", () => {
    const { container } = render(<Message from="assistant">Hello</Message>);

    const el = container.firstElementChild;
    expect(el).toHaveClass("max-w-[95%]");
  });

  it("aligns user messages to the right", () => {
    const { container } = render(<Message from="user">Hello</Message>);

    const el = container.firstElementChild;
    expect(el).toHaveClass("ml-auto");
  });
});
