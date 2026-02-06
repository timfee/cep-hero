/**
 * Tests for the FileTree components.
 * Validates cursor-pointer on interactive elements and tree structure.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "bun:test";

import { FileTree, FileTreeFolder, FileTreeFile } from "./file-tree";

describe("FileTreeFolder", () => {
  it("has cursor-pointer on the trigger button", () => {
    const { getByRole } = render(
      <FileTree>
        <FileTreeFolder name="src" path="/src">
          <FileTreeFile name="index.ts" path="/src/index.ts" />
        </FileTreeFolder>
      </FileTree>
    );

    const button = getByRole("button");
    expect(button).toHaveClass("cursor-pointer");
  });

  it("renders as a treeitem with keyboard support", () => {
    const { getByRole } = render(
      <FileTree>
        <FileTreeFolder name="src" path="/src">
          <FileTreeFile name="index.ts" path="/src/index.ts" />
        </FileTreeFolder>
      </FileTree>
    );

    const treeitem = getByRole("treeitem");
    expect(treeitem).toHaveAttribute("tabIndex", "0");
  });
});

describe("FileTreeFile", () => {
  it("has cursor-pointer for click interaction", () => {
    const { getByRole } = render(
      <FileTree>
        <FileTreeFile name="README.md" path="/README.md" />
      </FileTree>
    );

    const treeitem = getByRole("treeitem");
    expect(treeitem).toHaveClass("cursor-pointer");
  });
});
