import { type TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

declare module "bun:test" {
  // oxlint-disable-next-line typescript-eslint/no-empty-interface, typescript-eslint/no-empty-object-type -- Declaration merging for jest-dom
  interface Matchers<T> extends TestingLibraryMatchers<
    typeof expect.stringContaining,
    T
  > {}
  // oxlint-disable-next-line typescript-eslint/no-empty-interface, typescript-eslint/no-empty-object-type -- Declaration merging for jest-dom
  interface AsymmetricMatchers extends TestingLibraryMatchers {}
}
