import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

import { unsupportedFeatures, validateAgentYaml } from '@gen-agent/core';
import { resolveOpenApi } from '@gen-agent/openapi';
import { generateProject } from '@gen-agent/templates';

const petstore = fileURLToPath(new URL('../../packages/openapi/src/__fixtures__/petstore3.json', import.meta.url));
const project = fileURLToPath(new URL('../output/openapi-petstore/', import.meta.url));

it('generates an agent from the official Petstore spec that passes mvnw verify', async () => {
  const yaml = `agent:
  name: pet-assistant
  model: { provider: ollama, name: qwen2.5:3b }
  openapi:
    - spec: petstore3.json
      baseUrl: https://petstore3.swagger.io/api/v3
`;
  const validated = validateAgentYaml(yaml);
  if (!validated.ok) throw new Error(JSON.stringify(validated.errors));
  const resolved = resolveOpenApi(validated.config, (spec) => readFileSync(join(dirname(petstore), spec), 'utf8'));
  if (!resolved.ok) throw new Error(resolved.errors.join('\n'));
  expect(resolved.file.agent.tools.length).toBeGreaterThan(10);
  expect(unsupportedFeatures(resolved.file)).toEqual([]);

  rmSync(project, { recursive: true, force: true });
  for (const file of await generateProject(resolved.file, '0.0.0-e2e')) {
    mkdirSync(dirname(join(project, file.path)), { recursive: true });
    writeFileSync(join(project, file.path), file.content, file.executable === true ? { mode: 0o755 } : {});
  }

  // Every imported tool is compiled and tested by the generated project: path, query, body and authentication.
  execFileSync(join(project, 'mvnw'), ['--batch-mode', '--no-transfer-progress', 'verify'], {
    cwd: project,
    stdio: 'pipe',
    encoding: 'utf8',
  });
});
