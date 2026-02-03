/**
 * Test setup for React Testing Library with happy-dom browser API registration.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll } from "bun:test";
import "@testing-library/jest-dom";

beforeAll(() => {
  GlobalRegistrator.register();
});

afterEach(() => {
  cleanup();
});
