import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

import { GENERATOR_VERSION } from '@gen-agent/core';

it('records the same generator version as the web UI (core GENERATOR_VERSION = CLI package version)', () => {
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  };

  expect(GENERATOR_VERSION).toBe(version);
});
