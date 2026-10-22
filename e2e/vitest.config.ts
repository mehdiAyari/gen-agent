import { defineConfig } from 'vitest/config';

// Each reference project runs a full `mvn verify`: generous timeouts, one project at a time.
export default defineConfig({
  test: {
    testTimeout: 15 * 60 * 1000,
    fileParallelism: false,
  },
});
