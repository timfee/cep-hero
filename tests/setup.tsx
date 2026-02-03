import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll } from "bun:test";
import "@testing-library/jest-dom";

// Register happy-dom globals for browser APIs
beforeAll(() => {
  GlobalRegistrator.register();
});

// Clean up after each test to reset DOM state
afterEach(() => {
  cleanup();
});
