import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { cleanup } from "@testing-library/react";
import { afterEach } from "bun:test";
import "@testing-library/jest-dom";

// Register happy-dom globals for browser APIs
GlobalRegistrator.register();

// Clean up after each test to reset DOM state
afterEach(() => {
  cleanup();
});
