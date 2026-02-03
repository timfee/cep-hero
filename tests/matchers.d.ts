import { type TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

/* oxlint-disable typescript-eslint/no-empty-interface, typescript-eslint/no-empty-object-type -- Declaration merging for jest-dom */
declare module "bun:test" {
  interface Matchers<T> extends TestingLibraryMatchers<
    typeof expect.stringContaining,
    T
  > {}
  interface AsymmetricMatchers extends TestingLibraryMatchers {}
}
/* oxlint-enable typescript-eslint/no-empty-interface, typescript-eslint/no-empty-object-type */
