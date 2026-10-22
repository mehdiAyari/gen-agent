import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Processed by Vitest so that tests can take its file system away, as in a browser.
  test: { server: { deps: { inline: ['ejs'] } } },
});
