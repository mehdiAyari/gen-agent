import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { unsupportedFeatures, validateAgentYaml } from '@gen-agent/core';
import { generateProject } from '@gen-agent/templates';

const references = fileURLToPath(new URL('../../packages/templates/references/', import.meta.url));
const output = fileURLToPath(new URL('../output/', import.meta.url));

describe.each(readdirSync(references).filter((name) => name.endsWith('.yaml')))('generated project %s', (reference) => {
  it('compiles and passes mvn verify', async () => {
    const result = validateAgentYaml(readFileSync(join(references, reference), 'utf8'));
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(unsupportedFeatures(result.config)).toEqual([]);

    const project = join(output, reference.replace('.yaml', ''));
    rmSync(project, { recursive: true, force: true });
    for (const file of await generateProject(result.config, '0.0.0-e2e')) {
      mkdirSync(dirname(join(project, file.path)), { recursive: true });
      writeFileSync(join(project, file.path), file.content);
    }

    // Throws with Maven's output when the build fails.
    execFileSync('mvn', ['--batch-mode', '--no-transfer-progress', 'verify'], {
      cwd: project,
      stdio: 'pipe',
      encoding: 'utf8',
    });
  });
});
