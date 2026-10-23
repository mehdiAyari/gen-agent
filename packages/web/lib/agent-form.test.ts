import { validateAgentYaml } from '@gen-agent/core';
import { describe, expect, it } from 'vitest';

import { defaultForm, formFromYaml, formToYaml, validateForm, withProfile, type AgentForm } from './agent-form';

const currentWeather: AgentForm['tools'][number] = {
  name: 'current-weather',
  type: 'http',
  description: 'Current temperature at a location',
  method: 'GET',
  url: 'https://api.open-meteo.com/v1/forecast',
  params: [{ name: 'latitude', type: 'number', required: true, description: 'Latitude', in: 'auto', apiName: '' }],
  auth: { type: 'none', env: '', header: '' },
  maxResponseChars: '',
};

const weather: AgentForm = {
  ...defaultForm(),
  name: 'weather-agent',
  description: 'Tells the current weather',
  provider: 'ollama',
  model: 'qwen2.5:3b',
  temperature: '0',
  tools: [currentWeather],
};

describe('formToYaml', () => {
  it('writes only what the user chose: defaults stay implicit, like a hand-written file', () => {
    expect(formToYaml(defaultForm())).toBe(`agent:
  name: my-agent
  model:
    provider: mistral
    name: mistral-small-latest
`);
  });

  it('writes a complete agent that core validates', () => {
    const yaml = formToYaml(weather);

    expect(yaml).toContain('temperature: 0');
    expect(validateAgentYaml(yaml)).toMatchObject({ ok: true, warnings: [] });
  });
});

describe('the standard profile', () => {
  it('writes only what differs from the profile', () => {
    expect(formToYaml(withProfile(defaultForm(), 'standard'))).toBe(`agent:
  name: my-agent
  profile: standard
  model:
    provider: mistral
    name: mistral-small-latest
`);
  });

  it('reads back a standard agent with its own choices', () => {
    const yaml = `agent:
  name: desk
  profile: standard
  model:
    provider: ollama
    name: llama3.1
  memory:
    type: in-memory
  security:
    rateLimit: 10/min
  deploy: []
`;
    const result = formFromYaml(yaml);
    if (!result.ok) throw new Error(result.errors.join('\n'));

    expect(result.form).toMatchObject({
      profile: 'standard',
      memoryType: 'in-memory',
      auth: 'oidc',
      rateLimit: '10/min',
      tokenBudget: '100000/day',
      dockerCompose: false,
    });
    expect(formToYaml(result.form)).toBe(yaml);
  });

  it('switches to the defaults of the chosen profile', () => {
    expect(withProfile(defaultForm(), 'standard')).toMatchObject({
      memoryType: 'jdbc',
      auth: 'oidc',
      rateLimit: '30/min',
      tokenBudget: '100000/day',
      dockerCompose: true,
    });
    expect(withProfile(withProfile(defaultForm(), 'standard'), 'minimal')).toEqual(defaultForm());
  });

  it('writes the cache and the observability only when they differ from the profile', () => {
    expect(formToYaml({ ...withProfile(defaultForm(), 'standard'), cache: false, observability: false })).toContain(
      'cache:\n    exact: none\n  observability:\n    otel: false\n    metrics: none\n',
    );
    expect(formToYaml({ ...defaultForm(), observability: true })).toContain(
      'observability:\n    otel: true\n    metrics: prometheus\n',
    );
  });

  it('keeps MCP servers, their arguments and the variables they get', () => {
    const yaml = `agent:
  name: desk
  model:
    provider: ollama
    name: llama3.1
  mcp:
    - name: files
      package: "@modelcontextprotocol/server-filesystem"
      version: 2.0.0
      runtime: node
      sandbox: none
      args: [ /srv/docs ]
    - name: github
      package: "@modelcontextprotocol/server-github"
      version: 2025.4.8
      runtime: node
      env: [ GITHUB_TOKEN ]
`;
    const result = formFromYaml(yaml);
    if (!result.ok) throw new Error(result.errors.join('\n'));

    expect(result.form.mcp).toEqual([
      {
        name: 'files',
        package: '@modelcontextprotocol/server-filesystem',
        version: '2.0.0',
        runtime: 'node',
        sandbox: 'none',
        args: '/srv/docs',
        env: '',
      },
      {
        name: 'github',
        package: '@modelcontextprotocol/server-github',
        version: '2025.4.8',
        runtime: 'node',
        sandbox: 'docker',
        args: '',
        env: 'GITHUB_TOKEN',
      },
    ]);
    expect(formToYaml(result.form)).toBe(yaml);
  });

  it('maps the limit errors to their fields', () => {
    const form = { ...defaultForm(), rateLimit: '30/min' };

    expect(Object.keys(validateForm(form).errors)).toEqual(['rateLimit']);
  });
});

describe('formFromYaml', () => {
  it('reads back what formToYaml wrote', () => {
    expect(formFromYaml(formToYaml(weather))).toEqual({ ok: true, form: weather });
  });

  it('keeps parameter placement, authentication and the response limit of HTTP tools', () => {
    const yaml = `agent:
  name: shop-assistant
  model:
    provider: ollama
    name: llama3.1
  tools:
    - name: add-note
      type: http
      description: Adds a note to an order
      method: POST
      url: https://shop.example.org/orders/{orderId}/notes
      auth: { type: header, name: X-API-Key, env: SHOP_API_KEY }
      maxResponseChars: 5000
      params:
        - { name: orderId, type: string, required: true, in: path }
        - { name: text, type: string, required: true, apiName: note_text }
`;
    const result = formFromYaml(yaml);
    if (!result.ok) throw new Error(result.errors.join('\n'));

    expect(result.form.tools[0]).toMatchObject({
      auth: { type: 'header', header: 'X-API-Key', env: 'SHOP_API_KEY' },
      maxResponseChars: '5000',
      params: [
        { name: 'orderId', in: 'path' },
        { name: 'text', in: 'auto' },
      ],
    });
    expect(formToYaml(result.form)).toBe(yaml);
  });

  it('explains what the web generator cannot handle yet', () => {
    const result = formFromYaml(
      'agent:\n  name: big\n  profile: production\n  model: { provider: mistral, name: m }\n',
    );

    expect(result).toEqual({
      ok: false,
      errors: ['agent.profile: "production" arrives in V5 (minimal and standard are generated)'],
    });
  });

  it('reports invalid files with their line', () => {
    const result = formFromYaml('agent:\n  name: Bad Name\n  model: { provider: mistral, name: m }\n');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/^line 2: agent.name: /);
  });
});

describe('validateForm', () => {
  it('maps core errors to form fields', () => {
    const errors = validateForm({ ...weather, temperature: '5', tools: [{ ...currentWeather, url: 'not a url' }] });

    expect(Object.keys(errors.errors)).toEqual(['temperature', 'tools.0.url']);
  });

  it('keeps warnings apart from errors', () => {
    const errors = validateForm({ ...weather, tools: [{ ...currentWeather, method: 'POST' }] });

    expect(errors.errors).toEqual({});
    expect(errors.warnings).toEqual([expect.stringMatching(/^current-weather: POST has side effects/)]);
  });

  it('names the tool and the field a warning is about, not its path in agent.yaml', () => {
    const { warnings } = validateForm({ ...weather, tools: [{ ...currentWeather, description: '' }] });

    expect(warnings).toEqual([expect.stringMatching(/^current-weather › description: missing/)]);
  });

  it('rejects a number that is not a number', () => {
    expect(Object.keys(validateForm({ ...weather, temperature: 'warm' }).errors)).toEqual(['temperature']);
  });
});
