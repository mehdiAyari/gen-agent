import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import { validateAgentYaml } from '@gen-agent/core';

import { agentYamlFromAnswers, generateCommand, newCommand } from './commands.js';
import { RecordingOutput } from './recording-output.js';

let cwd: string;
let out: RecordingOutput;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'gen-agent-cli-'));
  out = new RecordingOutput();
});

const agentYaml = `agent:
  name: weather-bot
  model:
    provider: mistral
    name: mistral-small-latest
  tools:
    - name: create-ticket
      type: http
      method: POST
      description: Creates a ticket
      url: https://tickets.example.org/api
`;

describe('gen-agent generate --from', () => {
  it('lists every environment variable the agent needs, the tokens of its tools included', async () => {
    writeFileSync(
      join(cwd, 'agent.yaml'),
      agentYaml.replace(
        '      url: https://tickets.example.org/api\n',
        '      url: https://tickets.example.org/api\n      auth: { type: bearer, env: TICKETS_API_TOKEN }\n',
      ),
    );

    expect(await generateCommand({ from: 'agent.yaml', cwd }, out)).toBe(0);
    expect(out.text()).toMatch(/export MISTRAL_API_KEY=\.\.\.\n {2}export TICKETS_API_TOKEN=\.\.\./);
  });

  it('generates the project in a directory named after the agent and prints the next steps', async () => {
    writeFileSync(join(cwd, 'agent.yaml'), agentYaml);

    const code = await generateCommand({ from: 'agent.yaml', cwd }, out);

    expect(code).toBe(0);
    expect(existsSync(join(cwd, 'weather-bot/pom.xml'))).toBe(true);
    expect(existsSync(join(cwd, 'weather-bot/.gen-agent.json'))).toBe(true);
    expect(statSync(join(cwd, 'weather-bot/mvnw')).mode & 0o111).not.toBe(0);
    expect(out.text()).toMatch(/MISTRAL_API_KEY/);
    expect(out.text()).toMatch(/warn: agent.yaml:7 agent.tools.0: POST has side effects/);
  });

  it('adds the operations of the specs agent.yaml refers to, and warns about the ones it skips', async () => {
    mkdirSync(join(cwd, 'specs'));
    writeFileSync(
      join(cwd, 'specs/shop.json'),
      JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'Shop', version: '1' },
        servers: [{ url: 'https://shop.example.org/api' }],
        paths: {
          '/orders/{orderId}': {
            get: {
              operationId: 'getOrder',
              summary: 'An order',
              parameters: [{ name: 'orderId', in: 'path', required: true }],
            },
          },
          '/files': { post: { operationId: 'upload', requestBody: { content: { 'text/csv': {} } } } },
        },
      }),
    );
    writeFileSync(join(cwd, 'agent.yaml'), `${agentYaml}  openapi:\n    - spec: specs/shop.json\n`);

    expect(await generateCommand({ from: 'agent.yaml', cwd }, out)).toBe(0);
    expect(
      existsSync(join(cwd, 'weather-bot/src/main/java/com/example/weatherbot/generated/tool/GetOrderTool.java')),
    ).toBe(true);
    expect(out.text()).toMatch(/warn: agent.yaml agent.openapi.0: upload skipped: the body is text\/csv/);
  });

  it('runs a standard project with Docker Compose', async () => {
    writeFileSync(join(cwd, 'agent.yaml'), agentYaml.replace('  tools:', '  profile: standard\n  tools:'));

    expect(await generateCommand({ from: 'agent.yaml', cwd }, out)).toBe(0);
    expect(existsSync(join(cwd, 'weather-bot/compose.yaml'))).toBe(true);
    expect(out.text()).toMatch(/export MISTRAL_API_KEY=\.\.\.\n {2}docker compose up --build/);
  });

  it('pulls the embedding model of the semantic cache with Ollama', async () => {
    writeFileSync(
      join(cwd, 'agent.yaml'),
      agentYaml
        .replace('  tools:', '  profile: production\n  tools:')
        .replace('provider: mistral\n    name: mistral-small-latest', 'provider: ollama\n    name: qwen2.5:3b'),
    );

    expect(await generateCommand({ from: 'agent.yaml', cwd }, out)).toBe(0);
    expect(out.text()).toMatch(/ollama pull qwen2\.5:3b\n {2}ollama pull nomic-embed-text\n/);
  });

  it('keeps agent.yaml and its specs in the project, so that gen-agent add and update work there', async () => {
    mkdirSync(join(cwd, 'specs'));
    writeFileSync(
      join(cwd, 'specs/ping.json'),
      JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'Ping', version: '1' },
        servers: [{ url: 'https://ping.example.org' }],
        paths: { '/ping': { get: { operationId: 'ping', summary: 'Ping' } } },
      }),
    );
    writeFileSync(join(cwd, 'agent.yaml'), `${agentYaml}  openapi:\n    - spec: specs/ping.json\n`);

    expect(await generateCommand({ from: 'agent.yaml', cwd }, out)).toBe(0);
    expect(readFileSync(join(cwd, 'weather-bot/agent.yaml'), 'utf8')).toBe(
      readFileSync(join(cwd, 'agent.yaml'), 'utf8'),
    );
    expect(existsSync(join(cwd, 'weather-bot/specs/ping.json'))).toBe(true);
  });

  it('writes to --output when given', async () => {
    writeFileSync(join(cwd, 'agent.yaml'), agentYaml);

    const code = await generateCommand({ from: 'agent.yaml', output: 'out/bot', cwd }, out);

    expect(code).toBe(0);
    expect(existsSync(join(cwd, 'out/bot/src/main/resources/application.yml'))).toBe(true);
  });

  it('reports validation errors with the file and the line, and writes nothing', async () => {
    writeFileSync(join(cwd, 'agent.yaml'), agentYaml.replace('mistral-small-latest', 'm\n    temperature: 9'));

    const code = await generateCommand({ from: 'agent.yaml', cwd }, out);

    expect(code).toBe(1);
    expect(out.text()).toMatch(/error: agent.yaml:6 agent.model.temperature: /);
    expect(existsSync(join(cwd, 'weather-bot'))).toBe(false);
  });

  it('refuses what this version cannot generate yet, with the version that brings it', async () => {
    writeFileSync(
      join(cwd, 'agent.yaml'),
      agentYaml.replace('  tools:', '  observability: { feedback: true }\n  tools:'),
    );

    const code = await generateCommand({ from: 'agent.yaml', cwd }, out);

    expect(code).toBe(1);
    expect(out.text()).toMatch(/agent.observability.feedback: feedback buttons arrive in a later version/);
    expect(existsSync(join(cwd, 'weather-bot'))).toBe(false);
  });

  it('never overwrites a non-empty directory', async () => {
    writeFileSync(join(cwd, 'agent.yaml'), agentYaml);
    mkdirSync(join(cwd, 'weather-bot'));
    writeFileSync(join(cwd, 'weather-bot/notes.txt'), 'mine');

    const code = await generateCommand({ from: 'agent.yaml', cwd }, out);

    expect(code).toBe(1);
    expect(out.text()).toMatch(/weather-bot is not empty/);
    expect(readFileSync(join(cwd, 'weather-bot/notes.txt'), 'utf8')).toBe('mine');
  });

  it('explains a missing file', async () => {
    const code = await generateCommand({ from: 'missing.yaml', cwd }, out);

    expect(code).toBe(1);
    expect(out.text()).toMatch(/cannot read missing.yaml/);
  });
});

describe('gen-agent new', () => {
  const answers = {
    name: 'support-bot',
    description: 'Answers customer questions',
    provider: 'ollama' as const,
    model: 'llama3.1',
    package: 'io.acme.support',
    tools: [
      {
        name: 'order-status',
        type: 'http' as const,
        description: 'Status of an order',
        url: 'https://shop.example.org/orders',
      },
      { name: 'refund', type: 'java' as const, description: 'Refunds an order' },
    ],
  };

  it('turns the answers into a valid agent.yaml', () => {
    const result = validateAgentYaml(agentYamlFromAnswers(answers));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.agent).toMatchObject({
      name: 'support-bot',
      package: 'io.acme.support',
      model: { provider: 'ollama', name: 'llama3.1' },
      tools: [{ name: 'order-status', type: 'http', method: 'GET' }, { name: 'refund' }],
    });
  });

  it('creates the project with its agent.yaml, ready to regenerate', async () => {
    const code = await newCommand(answers, { cwd }, out);

    expect(code).toBe(0);
    expect(validateAgentYaml(readFileSync(join(cwd, 'support-bot/agent.yaml'), 'utf8')).ok).toBe(true);
    expect(existsSync(join(cwd, 'support-bot/src/main/java/io/acme/support/tool/DefaultRefundHandler.java'))).toBe(
      true,
    );
    expect(out.text()).toMatch(/ollama pull llama3.1/);
  });
});
