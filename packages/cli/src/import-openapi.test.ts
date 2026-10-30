import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import { validateAgentYaml } from '@gen-agent/core';

import { importOpenApiCommand } from './import-openapi.js';
import { RecordingOutput } from './recording-output.js';

const agentYaml = `# The shop assistant: answers customers.
agent:
  name: shop-assistant
  model:
    provider: mistral
    name: mistral-small-latest
`;

const shop = JSON.stringify({
  openapi: '3.0.3',
  info: { title: 'Shop API', version: '1' },
  servers: [{ url: '/api' }],
  security: [{ bearer: [] }],
  components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
  paths: {
    '/orders/{orderId}': {
      get: {
        operationId: 'getOrder',
        summary: 'Status of an order',
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
      },
    },
    '/orders': { get: { operationId: 'listOrders', summary: 'Orders of the customer' } },
    '/files': { post: { operationId: 'upload', requestBody: { content: { 'text/csv': {} } } } },
  },
});

let cwd: string;
let out: RecordingOutput;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'gen-agent-import-'));
  out = new RecordingOutput();
  writeFileSync(join(cwd, 'agent.yaml'), agentYaml);
});

const agentFile = (): string => readFileSync(join(cwd, 'agent.yaml'), 'utf8');

describe('gen-agent import openapi', () => {
  it('refers to a local spec from agent.yaml, keeping the comments, and lists what it found', async () => {
    writeFileSync(join(cwd, 'shop.json'), shop);

    const code = await importOpenApiCommand({ source: 'shop.json', cwd, baseUrl: 'https://shop.example.org/api' }, out);

    expect(code).toBe(0);
    expect(agentFile()).toBe(`${agentYaml}  openapi:
    - spec: shop.json
      baseUrl: https://shop.example.org/api
`);
    expect(validateAgentYaml(agentFile()).ok).toBe(true);
    expect(out.text()).toMatch(
      /Shop API: 2 tools\n {2}get-order +GET https:\/\/shop.example.org\/api\/orders\/\{orderId\}/,
    );
    expect(out.text()).toMatch(/warn: upload skipped: the body is text\/csv/);
    expect(out.text()).toMatch(/SHOP_TOKEN/);
  });

  it('imports a public API without authentication with --no-auth, whatever its spec declares', async () => {
    writeFileSync(join(cwd, 'shop.json'), shop);

    const options = { source: 'shop.json', cwd, baseUrl: 'https://shop.example.org/api', auth: false } as const;
    expect(await importOpenApiCommand(options, out)).toBe(0);

    expect(agentFile()).toMatch(/- spec: shop.json\n {6}baseUrl: https:\/\/shop.example.org\/api\n {6}auth: none\n/);
    expect(validateAgentYaml(agentFile()).ok).toBe(true);
    expect(out.text()).not.toMatch(/SHOP_TOKEN/);
  });

  it('downloads a spec over https into specs/, with the base URL the spec is relative to', async () => {
    const fetched: string[] = [];
    const code = await importOpenApiCommand(
      { source: 'https://shop.example.org/api/openapi.json', cwd, include: ['getOrder'] },
      out,
      (url) => {
        fetched.push(url);
        return Promise.resolve(shop);
      },
    );

    expect(code).toBe(0);
    expect(fetched).toEqual(['https://shop.example.org/api/openapi.json']);
    expect(readFileSync(join(cwd, 'specs/shop.json'), 'utf8')).toBe(shop);
    expect(agentFile()).toContain(`  openapi:
    - spec: specs/shop.json
      include: [ getOrder ]
      baseUrl: https://shop.example.org/api
`);
  });

  it('copies the tools into agent.yaml with --expand, to edit them by hand', async () => {
    writeFileSync(join(cwd, 'shop.json'), shop);

    const code = await importOpenApiCommand(
      { source: 'shop.json', cwd, baseUrl: 'https://shop.example.org/api', include: ['getOrder'], expand: true },
      out,
    );

    expect(code).toBe(0);
    expect(agentFile()).toBe(`${agentYaml}  tools:
    - name: get-order
      type: http
      description: Status of an order
      url: https://shop.example.org/api/orders/{orderId}
      auth: { type: bearer, env: SHOP_TOKEN }
      params:
        - { name: orderId, type: string, required: true }
`);
    expect(validateAgentYaml(agentFile())).toMatchObject({ ok: true, warnings: [] });
  });

  it('changes nothing when the import fails', async () => {
    writeFileSync(join(cwd, 'shop.json'), shop);

    expect(await importOpenApiCommand({ source: 'shop.json', cwd }, out)).toBe(1);
    expect(out.text()).toMatch(
      /error: servers: the API URL "\/api" is relative: give the base URL of the API \(--base-url\)/,
    );
    expect(await importOpenApiCommand({ source: 'http://shop.example.org/openapi.json', cwd }, out)).toBe(1);
    expect(out.text()).toMatch(/error: only https URLs are downloaded/);
    expect(await importOpenApiCommand({ source: 'missing.json', cwd }, out)).toBe(1);
    expect(agentFile()).toBe(agentYaml);
    expect(existsSync(join(cwd, 'specs'))).toBe(false);
  });

  it('refuses a tool name the agent already has', async () => {
    writeFileSync(
      join(cwd, 'agent.yaml'),
      `${agentYaml}  tools:\n    - { name: get-order, type: java, description: Mine }\n`,
    );
    writeFileSync(join(cwd, 'shop.json'), shop);

    const code = await importOpenApiCommand(
      { source: 'shop.json', cwd, baseUrl: 'https://shop.example.org/api', expand: true },
      out,
    );

    expect(code).toBe(1);
    expect(out.text()).toMatch(/error: get-order is already a tool of the agent: choose the operations with --include/);
  });

  it('needs an agent.yaml to add the tools to', async () => {
    const code = await importOpenApiCommand({ source: 'shop.json', cwd, to: 'other.yaml' }, out);

    expect(code).toBe(1);
    expect(out.text()).toMatch(/error: cannot read other.yaml: create the agent first with gen-agent new/);
  });
});
