import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { validateAgentYaml, type ValidationResult } from './validate.js';

const dossierExample = readFileSync(new URL('./__fixtures__/spec-example.yaml', import.meta.url), 'utf8');

const defaultModel = 'model:\n  provider: mistral\n  name: mistral-small-latest\n';

/** An agent named weather-bot, with `body` (YAML at the agent level) and a default model unless `body` has one. */
function withAgent(body: string): string {
  const model = /^model:/m.test(body) ? '' : defaultModel;
  return `agent:\n  name: weather-bot\n${(model + body).replace(/^(?=.)/gm, '  ')}`;
}

const minimal = withAgent('');

function errorsOf(result: ValidationResult): string[] {
  return result.ok ? [] : result.errors.map((e) => `${e.path}: ${e.message}`);
}

function warningsOf(result: ValidationResult): string[] {
  return result.warnings.map((w) => `${w.path}: ${w.message}`);
}

describe('validateAgentYaml', () => {
  describe('valid files', () => {
    it('accepts the complete example from the project specification', () => {
      const result = validateAgentYaml(dossierExample);

      expect(errorsOf(result)).toEqual([]);
      expect(result.ok).toBe(true);
    });

    it('applies defaults to a minimal file', () => {
      const result = validateAgentYaml(minimal);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.config.agent).toMatchObject({
        name: 'weather-bot',
        profile: 'minimal',
        java: 21,
        build: 'maven',
        springAi: '2.0.1',
        prompt: { system: 'prompts/system.md', aiDisclosure: true },
        memory: { type: 'in-memory', window: 20 },
        tools: [],
        interface: ['rest'],
      });
    });

    it('equips the standard profile: JDBC memory, OIDC, request and token limits, Docker Compose', () => {
      const result = validateAgentYaml(withAgent('profile: standard\n'));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.config.agent).toMatchObject({
        memory: { type: 'jdbc', window: 20 },
        security: { auth: 'oidc', rateLimit: '30/min', tokenBudget: '100000/day' },
        deploy: ['docker-compose'],
      });
    });

    it('adds the exact cache and the observability of the standard profile', () => {
      const result = validateAgentYaml(withAgent('profile: standard\n'));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.config.agent).toMatchObject({
        cache: { exact: 'redis' },
        observability: { otel: true, metrics: 'prometheus' },
      });
    });

    it('accepts MCP servers with their arguments and the names of the variables they need', () => {
      const result = validateAgentYaml(
        withAgent(`mcp:
  - name: github
    package: "@modelcontextprotocol/server-github"
    version: 2025.4.8
    runtime: node
    env: [GITHUB_PERSONAL_ACCESS_TOKEN]
  - name: files
    package: "@modelcontextprotocol/server-filesystem"
    version: 2025.8.21
    runtime: node
    sandbox: none
    args: [/srv/documents]
`),
      );

      expect(errorsOf(result)).toEqual([]);
    });

    it('protects personal data in the production profile', () => {
      const result = validateAgentYaml(withAgent('profile: production\n'));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.config.agent).toMatchObject({
        memory: { type: 'jdbc', retention: '30d' },
        security: { auth: 'oidc', piiMasking: true },
        cache: { exact: 'redis', semantic: { threshold: 0.95, scope: 'user' } },
        gdpr: { erasureEndpoint: true, logsWithoutPii: true },
      });
    });

    it('guards a production agent, with its own limits kept', () => {
      const result = validateAgentYaml(
        withAgent('profile: production\nsecurity:\n  outputGuard: false\nlimits:\n  timeout: 30s\n'),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.config.agent.security).toMatchObject({ injectionDetection: true, outputGuard: false });
      expect(result.config.agent.limits).toEqual({ maxIterations: 8, timeout: '30s' });
    });

    it('keeps no retention for conversations held in memory in the production profile', () => {
      const result = validateAgentYaml(withAgent('profile: production\nmemory:\n  type: in-memory\n'));

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.config.agent.memory.retention).toBeUndefined();
    });

    it.each([
      [
        'a semantic cache without sign-in',
        'cache:\n  semantic: { threshold: 0.9 }\n',
        'agent.cache.semantic: answers are cached per user: set security.auth: oidc',
      ],
      [
        'the erasure endpoint without sign-in',
        'gdpr:\n  erasureEndpoint: true\n',
        'agent.gdpr.erasureEndpoint: data is erased per user: set security.auth: oidc',
      ],
      [
        'a retention without a database',
        'memory:\n  retention: 30d\n',
        'agent.memory.retention: only conversations kept in Postgres are purged: set memory.type: jdbc',
      ],
    ])('refuses %s', (_, yaml, error) => {
      expect(errorsOf(validateAgentYaml(withAgent(yaml)))).toEqual([error]);
    });

    it('refuses a semantic cache with a provider that has no embedding model', () => {
      const result = validateAgentYaml(
        withAgent(
          'model: { provider: anthropic, name: claude-sonnet-5 }\nsecurity: { auth: oidc }\ncache:\n  semantic: { threshold: 0.9 }\n',
        ),
      );

      expect(errorsOf(result)).toEqual([
        'agent.cache.semantic: anthropic has no embedding model: use openai, mistral or ollama, or no semantic cache',
      ]);
    });

    it('keeps what the file sets over the profile defaults', () => {
      const result = validateAgentYaml(
        withAgent('profile: standard\nmemory:\n  type: in-memory\nsecurity:\n  auth: none\ndeploy: []\n'),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Without users there is nobody to count requests or tokens for: no limits by default.
      expect(result.config.agent).toMatchObject({
        memory: { type: 'in-memory' },
        security: { auth: 'none' },
        deploy: [],
      });
      expect(result.config.agent.security).not.toHaveProperty('rateLimit');
    });

    it('leaves the minimal profile without security, database or Docker', () => {
      const result = validateAgentYaml(minimal);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.config.agent.memory.type).toBe('in-memory');
      expect(result.config.agent.security).toBeUndefined();
      expect(result.config.agent.deploy).toBeUndefined();
    });

    it('accepts tools with a description, a method and typed parameters', () => {
      const result = validateAgentYaml(
        withAgent(`
tools:
  - name: forecast
    type: http
    description: Weather forecast for a location
    method: GET
    url: https://api.open-meteo.com/v1/forecast
    params:
      - { name: latitude, type: number, required: true, description: Latitude }
      - { name: days, type: integer }
  - name: book-leave
    type: java
    description: Books a day off
    params:
      - { name: date, type: string, required: true }
`),
      );

      expect(errorsOf(result)).toEqual([]);
      expect(warningsOf(result)).toEqual([]);
    });
  });

  describe('syntax and structure errors', () => {
    it('reports a YAML syntax error with its line', () => {
      const result = validateAgentYaml('agent:\n  name: [unclosed\n');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0]?.line).toBeGreaterThan(0);
    });

    it('rejects an unknown key, so typos never pass silently', () => {
      const result = validateAgentYaml(withAgent('temprature: 0.2\n'));

      expect(errorsOf(result)).toEqual([expect.stringMatching(/^agent: unknown key "temprature"/)]);
    });

    it('reports the path and line of an invalid value', () => {
      const result = validateAgentYaml(withAgent('model:\n  provider: mistral\n  name: m\n  temperature: 3\n'));

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0]).toMatchObject({ path: 'agent.model.temperature', line: 6 });
    });

    it('requires a kebab-case agent name', () => {
      const result = validateAgentYaml(minimal.replace('weather-bot', 'Weather Bot'));

      expect(errorsOf(result)).toEqual([expect.stringMatching(/^agent.name: /)]);
    });

    it('rejects an invalid Java package', () => {
      const result = validateAgentYaml(withAgent('package: Com.Example.2bot\n'));

      expect(errorsOf(result)).toEqual([expect.stringMatching(/^agent.package: /)]);
    });

    it('rejects duplicated tool names', () => {
      const result = validateAgentYaml(
        withAgent(`
tools:
  - { name: forecast, type: http, url: https://example.org/a }
  - { name: forecast, type: java }
`),
      );

      expect(errorsOf(result)).toEqual([expect.stringMatching(/^agent.tools.1.name: duplicate tool name "forecast"/)]);
    });

    it.each([
      ['memory:\n  type: jdbc\n  retention: 30 days\n', 'agent.memory.retention'],
      ['security:\n  rateLimit: 30 per minute\n', 'agent.security.rateLimit'],
      ['limits:\n  timeout: 1min\n', 'agent.limits.timeout'],
    ])('rejects a badly formatted duration or rate: %s', (yaml, path) => {
      const result = validateAgentYaml(withAgent(yaml));

      expect(errorsOf(result)).toEqual([expect.stringMatching(new RegExp(`^${path.replace(/\./g, '\\.')}: `))]);
    });
  });

  describe('rules from the specification', () => {
    it('refuses an API key written in clear and asks for an environment variable', () => {
      const result = validateAgentYaml(
        withAgent(
          'tools:\n  - { name: forecast, type: http, url: "https://example.org/v1?key=sk-proj-abcdefghijklmnop1234" }\n',
        ),
      );

      expect(errorsOf(result)).toEqual([expect.stringMatching(/^agent.tools.0.url: .*\$\{[A-Z_]+\}/)]);
    });

    it('refuses a non-EU provider when euOnly is set, including the fallback', () => {
      const result = validateAgentYaml(
        withAgent(
          'gdpr:\n  euOnly: true\nmodel:\n  provider: mistral\n  name: m\n  fallback:\n    provider: openai\n    name: gpt\n',
        ),
      );

      expect(errorsOf(result)).toEqual([expect.stringMatching(/^agent.model.fallback.provider: .*outside the EU/)]);
    });

    it('accepts a non-EU provider with euOnly when explicitly allowed', () => {
      const result = validateAgentYaml(
        withAgent('gdpr:\n  euOnly: true\n  allowNonEuProviders: true\nmodel:\n  provider: openai\n  name: gpt\n'),
      );

      expect(errorsOf(result)).toEqual([]);
    });

    it.each(['latest', '^1.0.0', '1.x'])('refuses a non-exact MCP version: %s', (version) => {
      const result = validateAgentYaml(
        withAgent(
          `mcp:\n  - { name: fs, package: "@scope/server", version: "${version}", runtime: node, sandbox: docker }\n`,
        ),
      );

      expect(errorsOf(result)).toEqual([expect.stringMatching(/^agent.mcp.0.version: /)]);
    });

    it('requires an explicit routing strategy', () => {
      const result = validateAgentYaml(
        withAgent('model:\n  provider: mistral\n  name: m\n  routing:\n    simple: small\n    complex: large\n'),
      );

      expect(errorsOf(result)).toEqual([expect.stringMatching(/^agent.model.routing.strategy: /)]);
    });

    it('refuses a global semantic cache when the agent keeps memory or has tools', () => {
      const result = validateAgentYaml(
        withAgent('security:\n  auth: oidc\ncache:\n  semantic:\n    threshold: 0.95\n    scope: global\n'),
      );

      expect(errorsOf(result)).toEqual([expect.stringMatching(/^agent.cache.semantic.scope: /)]);
    });

    it('keeps the cache per user, so it needs signed-in users', () => {
      const result = validateAgentYaml(withAgent('cache:\n  exact: redis\n'));

      expect(errorsOf(result)).toEqual(['agent.cache.exact: answers are cached per user: set security.auth: oidc']);
    });

    it.each(['rateLimit: 30/min', 'tokenBudget: 1000/day'])('needs signed-in users to apply %s', (limit) => {
      const result = validateAgentYaml(withAgent(`security:\n  ${limit}\n`));

      expect(errorsOf(result)).toEqual([
        expect.stringMatching(
          /^agent\.security\.(rateLimit|tokenBudget): limits are counted per user: set auth: oidc$/,
        ),
      ]);
    });

    it('warns when a tool with side effects has no human approval', () => {
      const result = validateAgentYaml(
        withAgent(
          'tools:\n  - { name: create-ticket, type: http, method: POST, url: https://example.org/tickets, description: Creates a ticket }\n',
        ),
      );

      expect(result.ok).toBe(true);
      expect(warningsOf(result)).toEqual([expect.stringMatching(/^agent.tools.0: .*approval/)]);
    });

    it('refuses a Java reserved word as a tool parameter name, since the generated code would not compile', () => {
      const result = validateAgentYaml(
        withAgent('tools:\n  - { name: lookup, type: java, params: [{ name: default, type: string }] }\n'),
      );

      expect(errorsOf(result)).toEqual([expect.stringMatching(/^agent.tools.0.params.0.name: .*reserved/)]);
    });

    it.each(['../secrets.md', '/etc/passwd', 'prompts/../../x.md'])(
      'keeps the system prompt inside the project: %s',
      (path) => {
        const result = validateAgentYaml(withAgent(`prompt:\n  system: "${path}"\n`));

        expect(errorsOf(result)).toEqual([expect.stringMatching(/^agent.prompt.system: /)]);
      },
    );

    it('warns when a tool has no description', () => {
      const result = validateAgentYaml(
        withAgent('tools:\n  - { name: forecast, type: http, url: https://example.org/a }\n'),
      );

      expect(warningsOf(result)).toEqual([expect.stringMatching(/^agent.tools.0.description: /)]);
    });
  });
  describe('HTTP tools', () => {
    const tool = (yaml: string): ValidationResult => validateAgentYaml(withAgent(`tools:\n${yaml}`));

    it('accepts a URL template, parameters placed explicitly, authentication and a response limit', () => {
      const result = tool(`  - name: order-status
    type: http
    description: Status of an order
    url: https://shop.example.org/api/orders/{orderId}
    auth: { type: bearer, env: SHOP_API_TOKEN }
    maxResponseChars: 5000
    params:
      - { name: orderId, type: string, required: true, in: path }
      - { name: verbose, type: boolean, in: query }
  - name: create-note
    type: http
    method: POST
    description: Adds a note to an order
    url: https://shop.example.org/api/orders/{orderId}/notes
    auth: { type: header, name: X-API-Key, env: SHOP_API_KEY }
    params:
      - { name: orderId, type: string, required: true }
      - { name: text, type: string, required: true }
`);

      expect(errorsOf(result)).toEqual([]);
    });

    it('needs a parameter for each placeholder of the URL', () => {
      const result = tool('  - { name: order, type: http, url: "https://shop.example.org/orders/{orderId}" }\n');

      expect(errorsOf(result)).toEqual([
        'agent.tools.0.url: {orderId} has no parameter: add { name: orderId, type: string, required: true }',
      ]);
    });

    it('refuses a path parameter missing from the URL', () => {
      const result = tool(
        '  - { name: order, type: http, url: "https://shop.example.org/orders", params: [{ name: orderId, type: string, required: true, in: path }] }\n',
      );

      expect(errorsOf(result)).toEqual([
        'agent.tools.0.params.0.in: the URL has no {orderId} placeholder for this path parameter',
      ]);
    });

    it('requires path parameters, since the URL cannot be built without them', () => {
      const result = tool(
        '  - { name: order, type: http, url: "https://shop.example.org/orders/{orderId}", params: [{ name: orderId, type: string }] }\n',
      );

      expect(errorsOf(result)).toEqual(['agent.tools.0.params.0.required: a path parameter must be required']);
    });

    it.each(['GET', 'DELETE'])('refuses a body parameter on %s, which sends no body', (method) => {
      const result = tool(
        `  - { name: order, type: http, method: ${method}, url: "https://shop.example.org/orders", params: [{ name: note, type: string, in: body }] }\n`,
      );

      expect(errorsOf(result)).toEqual([`agent.tools.0.params.0.in: ${method} sends no body: use query`]);
    });

    it('refuses an API name on a Java tool or a path parameter, where it would be meaningless', () => {
      const result = tool(`  - { name: lookup, type: java, params: [{ name: id, apiName: the_id, type: string }] }
  - { name: order, type: http, url: "https://shop.example.org/orders/{orderId}", params: [{ name: orderId, apiName: order_id, type: string, required: true }] }
`);

      expect(errorsOf(result)).toEqual([
        'agent.tools.0.params.0.apiName: only HTTP tools send parameters under another name',
        'agent.tools.1.params.0.apiName: a path parameter has no name in the request: remove apiName',
      ]);
    });

    it('keeps the placement of parameters to HTTP tools', () => {
      const result = tool('  - { name: lookup, type: java, params: [{ name: id, type: string, in: query }] }\n');

      expect(errorsOf(result)).toEqual(['agent.tools.0.params.0.in: only HTTP tools place their parameters']);
    });

    it.each([
      ['an environment variable name', '{ type: bearer, env: shop-token }', 'agent.tools.0.auth.env'],
      ['a header name for header authentication', '{ type: header, env: SHOP_API_KEY }', 'agent.tools.0.auth.name'],
    ])('requires %s', (_, auth, path) => {
      const result = tool(`  - { name: order, type: http, url: "https://shop.example.org/orders", auth: ${auth} }\n`);

      expect(errorsOf(result)).toEqual([expect.stringMatching(new RegExp(`^${path.replaceAll('.', '\\.')}: `))]);
    });
  });
});
