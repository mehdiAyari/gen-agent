import { spawn, type ChildProcess } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { validateAgentYaml } from '@gen-agent/core';
import { generateProject } from '@gen-agent/templates';

/**
 * Agents started for real, on Ollama, and asked real questions: what the fake model of the generated tests cannot show
 * (the application starts with its real configuration, the provider answers, a tool is offered to it). Runs when
 * LIVE_MODEL names a chat model Ollama serves, such as qwen2.5:0.5b; the quality of the answers is not judged here.
 */
const model = process.env.LIVE_MODEL;
const examples = fileURLToPath(new URL('../../examples/', import.meta.url));
const output = fileURLToPath(new URL('../output/live/', import.meta.url));
const port = 18080;

let agent: ChildProcess | undefined;

afterEach(() => {
  // The whole process group: the wrapper, Maven and the JVM it forked.
  if (agent?.pid !== undefined) process.kill(-agent.pid, 'SIGTERM');
  agent = undefined;
});

/** Starts the project with the given goal and waits until it answers, or fails with its log. */
async function start(project: string, goal: string, ready: (log: string) => boolean): Promise<() => string> {
  const log = join(project, 'live.log');
  writeFileSync(log, '');
  agent = spawn('sh', ['-c', `./mvnw --batch-mode --quiet ${goal} >> live.log 2>&1`], {
    cwd: project,
    detached: true,
    env: { ...process.env, SPRING_AI_OLLAMA_CHAT_MODEL: model, SERVER_PORT: String(port), MANAGEMENT_SERVER_PORT: '0' },
  });
  const read = (): string => readFileSync(log, 'utf8');
  for (let waited = 0; waited < 300_000; waited += 2000) {
    if (ready(read())) return read;
    if (agent.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`${project} did not start:\n${read().slice(-4000)}`);
}

async function ask(
  message: string,
  conversationId?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`http://localhost:${String(port)}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, ...(conversationId === undefined ? {} : { conversationId }) }),
    signal: AbortSignal.timeout(300_000),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describe.skipIf(model === undefined)('agents started for real on Ollama', () => {
  it('answers from the documents of docs-analyst, its Postgres started in Docker', async () => {
    const project = join(output, 'docs-analyst');
    rmSync(project, { recursive: true, force: true });
    cpSync(join(examples, 'docs-analyst/app'), project, {
      recursive: true,
      filter: (path) => !path.includes('/target'),
    });
    const log = await start(project, 'spring-boot:test-run', (text) => (text.match(/Indexed /g) ?? []).length >= 4);

    const answer = await ask('What is the daily meal allowance during a work trip?');

    expect(answer.status, JSON.stringify(answer.body)).toBe(200);
    expect(String(answer.body.reply).trim()).not.toBe('');
    expect(log()).toMatch(/Answered in \d+ ms/);
  }, 900_000);

  it('keeps a conversation going with a minimal agent that has a tool', async () => {
    const result = validateAgentYaml(`agent:
  name: live-check
  model: { provider: ollama, name: ${String(model)}, temperature: 0 }
  tools:
    - { name: opening-hours, type: java, description: Opening hours of the shop }
`);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    const project = join(output, 'live-check');
    rmSync(project, { recursive: true, force: true });
    for (const file of await generateProject(result.config, '0.0.0-e2e')) {
      mkdirSync(dirname(join(project, file.path)), { recursive: true });
      const bytes = file.encoding === 'base64' ? Buffer.from(file.content, 'base64') : file.content;
      writeFileSync(join(project, file.path), bytes, file.executable === true ? { mode: 0o755 } : {});
    }
    await start(project, 'spring-boot:run', (text) => text.includes('Started LiveCheckApplication'));

    const first = await ask('My name is Ada. Say hello.');
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    const second = await ask('What is my name?', String(first.body.conversationId));

    expect(second.status, JSON.stringify(second.body)).toBe(200);
    expect(String(second.body.reply).trim()).not.toBe('');
  }, 900_000);
});
