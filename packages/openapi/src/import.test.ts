import { readFileSync } from 'node:fs';

import { validateAgentYaml } from '@gen-agent/core';
import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';

import { importOpenApi, type ImportedTool, type OpenApiImport } from './import.js';

/** A spec with the given paths, an absolute server and optional components. */
function spec(paths: object, extra: object = {}): string {
  return JSON.stringify({
    openapi: '3.0.3',
    info: { title: 'Shop API', version: '1.0.0' },
    servers: [{ url: 'https://shop.example.org/api' }],
    paths,
    ...extra,
  });
}

function imported(source: string, options: Parameters<typeof importOpenApi>[1] = {}): OpenApiImport {
  const result = importOpenApi(source, options);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.value;
}

/** The tools are valid agent.yaml tools: the generator accepts them as they are. */
function expectValidTools(tools: ImportedTool[]): void {
  const agent = { agent: { name: 'imported', model: { provider: 'ollama', name: 'llama3.1' }, tools } };
  const result = validateAgentYaml(stringify(agent));

  expect(result.ok ? [] : result.errors).toEqual([]);
}

describe('importOpenApi', () => {
  it('turns operations into HTTP tools: path, query and JSON body parameters', () => {
    const { tools, skipped } = imported(
      spec(
        {
          '/orders/{orderId}': {
            get: {
              operationId: 'getOrder',
              summary: 'Status and delivery date of an order',
              parameters: [
                { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } },
                { name: 'withItems', in: 'query', schema: { type: 'boolean' }, description: 'Include the items' },
              ],
            },
          },
          '/orders': {
            post: {
              operationId: 'createOrder',
              description: 'Creates an order.\nThe customer must exist.',
              requestBody: {
                required: true,
                content: { 'application/json': { schema: { $ref: '#/components/schemas/NewOrder' } } },
              },
            },
          },
        },
        {
          components: {
            schemas: {
              NewOrder: {
                type: 'object',
                required: ['product', 'quantity'],
                properties: {
                  id: { type: 'string', readOnly: true },
                  product: { type: 'string', description: 'Product code' },
                  quantity: { type: 'integer' },
                  price: { type: 'number' },
                },
              },
            },
          },
        },
      ),
    );

    expect(skipped).toEqual([]);
    expect(tools).toEqual([
      {
        name: 'get-order',
        type: 'http',
        description: 'Status and delivery date of an order',
        url: 'https://shop.example.org/api/orders/{orderId}',
        params: [
          { name: 'orderId', type: 'string', required: true },
          { name: 'withItems', type: 'boolean', description: 'Include the items' },
        ],
      },
      {
        name: 'create-order',
        type: 'http',
        method: 'POST',
        description: 'Creates an order. The customer must exist.',
        url: 'https://shop.example.org/api/orders',
        params: [
          { name: 'product', type: 'string', required: true, description: 'Product code' },
          { name: 'quantity', type: 'integer', required: true },
          { name: 'price', type: 'number' },
        ],
      },
    ]);
    expectValidTools(tools);
  });

  it('names tools after the operation id, else after the method and the path, without duplicates', () => {
    const { tools } = imported(
      spec({
        '/pets': {
          get: { operationId: 'list_pets' },
          post: { operationId: 'Pets.Create' },
        },
        '/pets/{petId}/photos': { get: { parameters: [{ name: 'petId', in: 'path', required: true }] } },
        '/animals': { get: { operationId: 'listPets' } },
      }),
    );

    expect(tools.map((tool) => tool.name)).toEqual([
      'list-pets',
      'pets-create',
      'get-pets-by-pet-id-photos',
      'list-pets-2',
    ]);
  });

  it('gives Java names to API names, and keeps the API name where it is sent', () => {
    const { tools } = imported(
      spec({
        '/employees/{employee_id}/leaves': {
          get: {
            operationId: 'listLeaves',
            parameters: [
              { name: 'employee_id', in: 'path', required: true, schema: { type: 'integer' } },
              { name: 'page-size', in: 'query', schema: { type: 'integer' } },
              { name: 'default', in: 'query', schema: { type: 'boolean' } },
            ],
          },
        },
      }),
    );

    expect(tools[0]).toMatchObject({
      url: 'https://shop.example.org/api/employees/{employeeId}/leaves',
      params: [
        { name: 'employeeId', type: 'integer', required: true },
        { name: 'pageSize', apiName: 'page-size', type: 'integer' },
        { name: 'defaultValue', apiName: 'default', type: 'boolean' },
      ],
    });
    expectValidTools(tools);
  });

  it('renames a body property named like a path parameter, and still sends it under its API name', () => {
    const { tools } = imported(
      spec({
        '/users/{username}': {
          put: {
            operationId: 'updateUser',
            parameters: [{ name: 'username', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { type: 'object', required: ['username'], properties: { username: { type: 'string' } } },
                },
              },
            },
          },
        },
      }),
    );

    expect(tools[0]?.params).toEqual([
      { name: 'username', type: 'string', required: true },
      { name: 'usernameInBody', apiName: 'username', type: 'string', required: true },
    ]);
    expectValidTools(tools);
  });

  it('describes allowed values and formats, and reads OpenAPI 3.1 nullable types', () => {
    const { tools } = imported(
      JSON.stringify({
        openapi: '3.1.0',
        info: { title: 'Shop', version: '1' },
        servers: [{ url: 'https://shop.example.org' }],
        paths: {
          '/orders': {
            get: {
              operationId: 'searchOrders',
              parameters: [
                { name: 'status', in: 'query', schema: { type: 'string', enum: ['open', 'shipped'] } },
                { name: 'since', in: 'query', description: 'First day', schema: { type: 'string', format: 'date' } },
                { name: 'limit', in: 'query', schema: { type: ['integer', 'null'] } },
              ],
            },
          },
        },
      }),
    );

    expect(tools[0]?.params).toEqual([
      { name: 'status', type: 'string', description: 'One of: open, shipped.' },
      { name: 'since', type: 'string', description: 'First day (format: date).' },
      { name: 'limit', type: 'integer' },
    ]);
  });

  it('authenticates from environment variables, with the first supported security option', () => {
    const { tools, warnings } = imported(
      spec(
        {
          '/orders': { get: { operationId: 'listOrders', security: [{ basic: [] }, { key: [] }] } },
          '/me': { get: { operationId: 'me' } },
          '/public': { get: { operationId: 'publicInfo', security: [] } },
        },
        {
          security: [{ oauth: ['read'] }],
          components: {
            securitySchemes: {
              basic: { type: 'http', scheme: 'basic' },
              key: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
              oauth: { type: 'oauth2', flows: {} },
            },
          },
        },
      ),
    );

    expect(tools.map((tool) => tool.auth)).toEqual([
      { type: 'header', name: 'X-API-Key', env: 'SHOP_API_KEY' },
      { type: 'bearer', env: 'SHOP_TOKEN' },
      undefined,
    ]);
    expect(warnings).toEqual([
      'me: OAuth 2 is not run by the agent: put an access token in SHOP_TOKEN (sent as a bearer token)',
    ]);
  });

  it('skips what an agent tool cannot send, and says why', () => {
    const { tools, skipped } = imported(
      spec(
        {
          '/files': {
            post: {
              operationId: 'upload',
              requestBody: { content: { 'multipart/form-data': { schema: { type: 'object' } } } },
            },
          },
          '/reports': {
            get: {
              operationId: 'report',
              parameters: [{ name: 'X-Tenant', in: 'header', required: true, schema: { type: 'string' } }],
            },
          },
          '/remote': { get: { operationId: 'remote', parameters: [{ $ref: 'common.yaml#/Limit' }] } },
          '/shapes': {
            post: {
              operationId: 'shape',
              requestBody: {
                content: { 'application/json': { schema: { oneOf: [{ type: 'object' }, { type: 'string' }] } } },
              },
            },
          },
          '/secure': { get: { operationId: 'secure', security: [{ query: [] }] } },
          '/old': { get: { operationId: 'old', deprecated: true } },
        },
        { components: { securitySchemes: { query: { type: 'apiKey', in: 'query', name: 'key' } } } },
      ),
    );

    expect(tools).toEqual([]);
    expect(skipped).toEqual([
      { operation: 'upload', reason: 'the body is multipart/form-data: only JSON bodies are supported' },
      { operation: 'report', reason: 'it needs the X-Tenant header, which a tool cannot send' },
      {
        operation: 'remote',
        reason: 'it refers to another file (common.yaml#/Limit): only references inside the spec are supported',
      },
      { operation: 'shape', reason: 'the JSON body is not a single object (oneOf): only flat objects are supported' },
      {
        operation: 'secure',
        reason: 'its authentication (API key in query) is not supported: use a bearer token or an API key header',
      },
      { operation: 'old', reason: 'it is deprecated (name it in include to import it anyway)' },
    ]);
  });

  it('leaves out optional values a tool cannot send, with a warning', () => {
    const { tools, warnings } = imported(
      spec({
        '/orders': {
          post: {
            operationId: 'createOrder',
            parameters: [{ name: 'X-Request-Id', in: 'header', schema: { type: 'string' } }],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { product: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } },
                  },
                },
              },
            },
          },
        },
      }),
    );

    expect(tools[0]?.params).toEqual([{ name: 'product', type: 'string' }]);
    expect(warnings).toEqual([
      'create-order: the optional X-Request-Id header is left out',
      'create-order: the optional body property tags (array) is left out',
    ]);
  });

  it('imports only the operations listed in include, deprecated ones too', () => {
    const source = spec({
      '/a': { get: { operationId: 'first' } },
      '/b': { get: { operationId: 'second', deprecated: true } },
      '/c': { get: { operationId: 'third' } },
    });

    expect(imported(source, { include: ['second', 'third'] }).tools.map((tool) => tool.name)).toEqual([
      'second',
      'third',
    ]);
    expect(importOpenApi(source, { include: ['missing'] })).toEqual({
      ok: false,
      errors: ['include: no operation missing in the spec'],
    });
  });

  it('warns when there are more tools than a model handles well', () => {
    const paths = Object.fromEntries(
      Array.from({ length: 21 }, (_, i) => [`/r${String(i)}`, { get: { operationId: `op${String(i)}` } }]),
    );

    expect(imported(spec(paths)).warnings).toEqual([
      '21 tools: models choose less reliably beyond 20, keep the ones the agent needs with include',
    ]);
  });

  describe('the API base URL', () => {
    const relative = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Petstore', version: '1' },
      servers: [{ url: '/api/v3' }],
      paths: { '/pets': { get: { operationId: 'listPets' } } },
    });

    it('resolves a relative server URL against the address of the spec', () => {
      expect(imported(relative, { specUrl: 'https://petstore.example.org/api/v3/openapi.json' }).tools[0]?.url).toBe(
        'https://petstore.example.org/api/v3/pets',
      );
    });

    it('asks for the base URL when the spec does not give an absolute one', () => {
      expect(importOpenApi(relative)).toEqual({
        ok: false,
        errors: ['servers: the API URL "/api/v3" is relative: give the base URL of the API (baseUrl)'],
      });
      expect(imported(relative, { baseUrl: 'https://petstore.example.org/v3/' }).tools[0]?.url).toBe(
        'https://petstore.example.org/v3/pets',
      );
    });

    it('fills server variables with their default value', () => {
      const source = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Shop', version: '1' },
        servers: [{ url: 'https://{region}.shop.example.org', variables: { region: { default: 'eu' } } }],
        paths: { '/ping': { get: { operationId: 'ping' } } },
      });

      expect(imported(source).tools[0]?.url).toBe('https://eu.shop.example.org/ping');
    });
  });

  it.each([
    ['not YAML at all', '{', /^the spec is not valid YAML or JSON/],
    ['Swagger 2.0', '{"swagger": "2.0", "paths": {}}', /^Swagger 2\.0 is not supported: convert the spec to OpenAPI 3/],
    ['another document', '{"name": "x"}', /^not an OpenAPI 3 spec: no openapi version/],
  ])('refuses %s', (_, source, error) => {
    const result = importOpenApi(source);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(error);
  });

  it('imports the official Petstore spec: what it can, and why it skips the rest', () => {
    const source = readFileSync(new URL('./__fixtures__/petstore3.json', import.meta.url), 'utf8');
    const { tools, skipped, warnings } = imported(source, {
      specUrl: 'https://petstore3.swagger.io/api/v3/openapi.json',
    });

    expect(tools.map((tool) => tool.name)).toMatchSnapshot();
    expect(skipped).toMatchSnapshot();
    expect(warnings).toMatchSnapshot();
    expect(tools.find((tool) => tool.name === 'get-pet-by-id')).toEqual({
      name: 'get-pet-by-id',
      type: 'http',
      description: 'Find pet by ID.',
      url: 'https://petstore3.swagger.io/api/v3/pet/{petId}',
      auth: { type: 'header', name: 'api_key', env: 'PETSTORE_API_KEY' },
      params: [{ name: 'petId', type: 'integer', required: true, description: 'ID of pet to return' }],
    });
    expectValidTools(tools);
  });
});
