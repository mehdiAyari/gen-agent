import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { unsupportedFeatures, validateAgentYaml } from '@gen-agent/core';
import { generateProject } from '@gen-agent/templates';

const references = fileURLToPath(new URL('../../packages/templates/references/', import.meta.url));
const output = fileURLToPath(new URL('../output/', import.meta.url));

describe.each(readdirSync(references).filter((name) => name.endsWith('.yaml')))('generated project %s', (reference) => {
  it('compiles and passes its build', async () => {
    const result = validateAgentYaml(readFileSync(join(references, reference), 'utf8'));
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(unsupportedFeatures(result.config)).toEqual([]);

    const project = join(output, reference.replace('.yaml', ''));
    rmSync(project, { recursive: true, force: true });
    for (const file of await generateProject(result.config, '0.0.0-e2e')) {
      mkdirSync(dirname(join(project, file.path)), { recursive: true });
      const bytes = file.encoding === 'base64' ? Buffer.from(file.content, 'base64') : file.content;
      writeFileSync(join(project, file.path), bytes, file.executable === true ? { mode: 0o755 } : {});
    }

    // Through the generated wrapper, as a developer would. Throws with the build output when it fails.
    const gradle = existsSync(join(project, 'gradlew'));
    execFileSync(
      join(project, gradle ? 'gradlew' : 'mvnw'),
      gradle ? ['--no-daemon', 'build'] : ['--batch-mode', '--no-transfer-progress', 'verify'],
      {
        cwd: project,
        stdio: 'pipe',
        encoding: 'utf8',
      },
    );

    // The Helm chart, when there is one: helm lint must pass, ingress and documents included.
    const chart = join(project, 'helm', reference.replace('.yaml', ''));
    if (existsSync(chart)) {
      execFileSync('helm', ['lint', '--strict', chart, '--set', 'ingress.enabled=true'], {
        stdio: 'pipe',
        encoding: 'utf8',
      });
    }
  });
});
