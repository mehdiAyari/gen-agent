import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

const cli = fileURLToPath(new URL('../../packages/cli/', import.meta.url));
const dockerfile = fileURLToPath(new URL('../cleanroom/Dockerfile', import.meta.url));

/** Runs a shell script in the clean room and returns what it printed. */
function inCleanRoom(script: string): string {
  return execFileSync('docker', ['run', '--rm', 'gen-agent-cleanroom', 'bash', '-ec', script], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

// The README followed on a machine that has only Java 21 and Node 22: what works on a developer's machine because
// something happens to be installed (Maven, unzip) fails here.
it('generates and builds projects on a machine with only Java and Node', () => {
  const context = mkdtempSync(join(tmpdir(), 'gen-agent-cleanroom-'));
  execFileSync('pnpm', ['pack', '--pack-destination', context], { cwd: cli, stdio: 'pipe' });
  copyFileSync(dockerfile, join(context, 'Dockerfile'));
  execFileSync('docker', ['build', '--quiet', '--tag', 'gen-agent-cleanroom', context], { stdio: 'pipe' });
  expect(readdirSync(context).some((name) => name.endsWith('.tgz'))).toBe(true);

  const maven = inCleanRoom(
    'command -v mvn unzip || true; gen-agent new my-assistant --provider ollama --model qwen2.5:3b > /dev/null; ' +
      'cd my-assistant && ./mvnw --batch-mode --quiet verify && echo MAVEN-OK',
  );
  expect(maven).toContain('MAVEN-OK');
  expect(maven).not.toMatch(/\/mvn\b|\/unzip\b/);

  const gradle = inCleanRoom(
    'printf "agent:\\n  name: gradle-check\\n  build: gradle\\n  model: { provider: ollama, name: m }\\n" > agent.yaml; ' +
      'gen-agent generate --from agent.yaml > /dev/null && cd gradle-check && ./gradlew --no-daemon --quiet build && echo GRADLE-OK',
  );
  expect(gradle).toContain('GRADLE-OK');
}, 900_000);
