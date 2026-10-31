import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Rendering a project formats its Java with Prettier: seconds each, more under coverage and beside the property tests.
  test: { testTimeout: 60_000 },
});
