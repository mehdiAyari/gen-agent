import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const cli = fileURLToPath(new URL('../../packages/cli/', import.meta.url));

it('the packed gen-agent package installs alone and generates a project', () => {
  const work = mkdtempSync(join(tmpdir(), 'gen-agent-pack-'));
  execFileSync('pnpm', ['pack', '--pack-destination', work], { cwd: cli, stdio: 'pipe' });
  const tarball = readdirSync(work).find((name) => name.endsWith('.tgz'));
  expect(tarball).toBeDefined();

  // A fresh npm project, as a user would get with npx: no workspace, no @gen-agent/* package available.
  writeFileSync(join(work, 'package.json'), '{"private": true}');
  execFileSync('npm', ['install', '--no-audit', '--no-fund', join(work, tarball ?? '')], { cwd: work, stdio: 'pipe' });
  writeFileSync(
    join(work, 'agent.yaml'),
    'agent:\n  name: packed-bot\n  model: { provider: ollama, name: llama3.1 }\n  tools:\n    - { name: clock, type: java, description: Current time }\n',
  );

  const output = execFileSync(join(work, 'node_modules/.bin/gen-agent'), ['generate', '--from', 'agent.yaml'], {
    cwd: work,
    encoding: 'utf8',
  });

  expect(output).toMatch(/Created packed-bot/);
  expect(existsSync(join(work, 'packed-bot/mvnw'))).toBe(true);
  expect(existsSync(join(work, 'packed-bot/src/main/java/com/example/packedbot/tool/DefaultClockHandler.java'))).toBe(
    true,
  );
});
