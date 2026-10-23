import { validateAgentYaml, type AgentFile } from '@gen-agent/core';
import { describe, expect, it } from 'vitest';

import { resolveOpenApi } from './resolve.js';

function parse(yaml: string): AgentFile {
  const result = validateAgentYaml(yaml);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.config;
}

const shop = JSON.stringify({
  openapi: '3.0.3',
  info: { title: 'Shop API', version: '1' },
  servers: [{ url: '/api' }],
  paths: {
    '/orders/{orderId}': {
      get: {
        operationId: 'getOrder',
        summary: 'An order',
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
      },
    },
    '/files': {
      post: { operationId: 'upload', requestBody: { content: { 'multipart/form-data': {} } } },
    },
  },
});

const files: Record<string, string> = { 'specs/shop.json': shop };
const read = (path: string): string => {
  const content = files[path];
  if (content === undefined) throw new Error(`ENOENT: ${path}`);
  return content;
};

const agent = (openapi: string, tools = ''): AgentFile =>
  parse(`agent:
  name: shop-assistant
  model: { provider: ollama, name: llama3.1 }
${tools}  openapi:
${openapi}`);

describe('resolveOpenApi', () => {
  it('adds the tools of each spec after the tools written by hand, and drops the reference', () => {
    const result = resolveOpenApi(
      agent(
        '    - { spec: specs/shop.json, baseUrl: "https://shop.example.org/api" }\n',
        '  tools:\n    - { name: refund, type: java, description: Refunds an order }\n',
      ),
      read,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.agent.openapi).toBeUndefined();
    expect(result.file.agent.tools.map((tool) => tool.name)).toEqual(['refund', 'get-order']);
    expect(result.file.agent.tools[1]).toMatchObject({
      method: 'GET',
      url: 'https://shop.example.org/api/orders/{orderId}',
      params: [{ name: 'orderId', required: true }],
    });
    expect(result.warnings).toEqual([
      'agent.openapi.0: upload skipped: the body is multipart/form-data: only JSON bodies are supported',
    ]);
  });

  it('refuses an operation named in include that cannot be imported', () => {
    expect(
      resolveOpenApi(
        agent('    - { spec: specs/shop.json, baseUrl: "https://shop.example.org/api", include: [upload] }\n'),
        read,
      ),
    ).toEqual({
      ok: false,
      errors: [
        'agent.openapi.0: upload cannot be imported: the body is multipart/form-data: only JSON bodies are supported',
      ],
    });
  });

  it('reports a missing spec, a relative server without baseUrl, and a tool name already taken', () => {
    expect(resolveOpenApi(agent('    - { spec: specs/missing.json }\n'), read)).toEqual({
      ok: false,
      errors: ['agent.openapi.0.spec: cannot read specs/missing.json (ENOENT: specs/missing.json)'],
    });
    expect(resolveOpenApi(agent('    - { spec: specs/shop.json }\n'), read)).toEqual({
      ok: false,
      errors: ['agent.openapi.0: servers: the API URL "/api" is relative: give the base URL of the API (baseUrl)'],
    });
    expect(
      resolveOpenApi(
        agent(
          '    - { spec: specs/shop.json, baseUrl: "https://shop.example.org/api" }\n',
          '  tools:\n    - { name: get-order, type: java, description: Mine }\n',
        ),
        read,
      ),
    ).toEqual({
      ok: false,
      errors: ['agent.openapi.0: get-order is already a tool of the agent: list the operations to import with include'],
    });
  });
});
