import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { beforeAll, expect, it } from 'vitest';

const cli = fileURLToPath(new URL('../../packages/cli/', import.meta.url));
let work: string;
let bin: string;

// A fresh npm project, as a user would get with npx: no workspace, no @gen-agent/* package available.
beforeAll(
  () => {
    work = mkdtempSync(join(tmpdir(), 'gen-agent-pack-'));
    execFileSync('pnpm', ['pack', '--pack-destination', work], { cwd: cli, stdio: 'pipe' });
    const tarball = readdirSync(work).find((name) => name.endsWith('.tgz'));
    if (tarball === undefined) throw new Error('pnpm pack produced no tarball');
    writeFileSync(join(work, 'package.json'), '{"private": true}');
    execFileSync('npm', ['install', '--no-audit', '--no-fund', join(work, tarball)], { cwd: work, stdio: 'pipe' });
    bin = join(work, 'node_modules/.bin/gen-agent');
  },
  5 * 60 * 1000,
);

it('the packed gen-agent package installs alone and generates a project', () => {
  writeFileSync(
    join(work, 'agent.yaml'),
    'agent:\n  name: packed-bot\n  model: { provider: ollama, name: llama3.1 }\n  tools:\n    - { name: clock, type: java, description: Current time }\n',
  );

  const output = execFileSync(bin, ['generate', '--from', 'agent.yaml'], { cwd: work, encoding: 'utf8' });

  expect(output).toMatch(/Created packed-bot/);
  expect(existsSync(join(work, 'packed-bot/mvnw'))).toBe(true);
  expect(existsSync(join(work, 'packed-bot/src/main/java/com/example/packedbot/tool/DefaultClockHandler.java'))).toBe(
    true,
  );
});

it('gen-agent mcp serves coding assistants over stdio', async () => {
  const workspace = join(work, 'assistant-workspace');
  mkdirSync(workspace);
  const client = new Client({ name: 'e2e', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: bin, args: ['mcp'], cwd: workspace }));
  try {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toContain('generate_project');

    const result = await client.callTool({
      name: 'generate_project',
      arguments: {
        yaml: 'agent:\n  name: mcp-bot\n  model: { provider: ollama, name: llama3.1 }\n',
        directory: 'mcp-bot',
      },
    });

    expect(result.isError).not.toBe(true);
    expect(existsSync(join(workspace, 'mcp-bot/agent.yaml'))).toBe(true);
    expect(existsSync(join(workspace, 'mcp-bot/pom.xml'))).toBe(true);
  } finally {
    await client.close();
  }
});
