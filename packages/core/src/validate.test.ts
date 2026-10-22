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
      const result = validateAgentYaml(withAgent('cache:\n  semantic:\n    threshold: 0.95\n    scope: global\n'));

      expect(errorsOf(result)).toEqual([expect.stringMatching(/^agent.cache.semantic.scope: /)]);
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

    it('warns when a tool has no description', () => {
      const result = validateAgentYaml(
        withAgent('tools:\n  - { name: forecast, type: http, url: https://example.org/a }\n'),
      );

      expect(warningsOf(result)).toEqual([expect.stringMatching(/^agent.tools.0.description: /)]);
    });
  });
});
