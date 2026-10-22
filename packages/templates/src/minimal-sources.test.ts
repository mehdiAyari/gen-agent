import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

import { MINIMAL_SOURCES } from './minimal-sources.js';

it('embeds exactly the files of minimal/ (run "pnpm build" after changing a template)', () => {
  const root = fileURLToPath(new URL('../minimal/', import.meta.url));
  const onDisk = Object.fromEntries(
    readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => relative(root, join(entry.parentPath, entry.name)).split(sep).join('/'))
      .map((path) => [path, readFileSync(join(root, path), 'utf8')]),
  );

  expect(MINIMAL_SOURCES).toEqual(onDisk);
});
