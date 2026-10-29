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
  approval: false,
  approvalExpiresAfter: '',
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
    - name: docs
      url: https://mcp.example.org/mcp
      auth: { type: bearer, env: DOCS_TOKEN }
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
        kind: 'local',
        url: '',
        tokenEnv: '',
        tokenHeader: '',
        network: false,
      },
      {
        name: 'github',
        package: '@modelcontextprotocol/server-github',
        version: '2025.4.8',
        runtime: 'node',
        sandbox: 'docker',
        args: '',
        env: 'GITHUB_TOKEN',
        kind: 'local',
        url: '',
        tokenEnv: '',
        tokenHeader: '',
        network: false,
      },
      {
        name: 'docs',
        package: '',
        version: '',
        runtime: 'node',
        sandbox: 'docker',
        args: '',
        env: '',
        kind: 'remote',
        url: 'https://mcp.example.org/mcp',
        tokenEnv: 'DOCS_TOKEN',
        tokenHeader: '',
        network: false,
      },
    ]);
    expect(formToYaml(result.form)).toBe(yaml);
  });

  it('adds the chat page to the interface', () => {
    const yaml = formToYaml({ ...defaultForm(), chatUi: true });

    expect(yaml).toContain('interface:\n    - rest\n    - chat-ui\n');
    const result = formFromYaml(yaml);
    expect(result.ok && result.form.chatUi).toBe(true);
  });

  it('maps the limit errors to their fields', () => {
    const form = { ...defaultForm(), rateLimit: '30/min' };

    expect(Object.keys(validateForm(form).errors)).toEqual(['rateLimit']);
  });
});

describe('the production profile', () => {
  it('writes only what differs from the profile', () => {
    expect(formToYaml(withProfile(defaultForm(), 'production'))).toBe(`agent:
  name: my-agent
  profile: production
  model:
    provider: mistral
    name: mistral-small-latest
`);
  });

  it('switches to the defaults of the production profile', () => {
    expect(withProfile(defaultForm(), 'production')).toMatchObject({
      memoryType: 'jdbc',
      auth: 'oidc',
      cache: true,
      piiMasking: true,
      logsWithoutPii: true,
      erasure: true,
      retention: '30d',
      semanticCache: true,
      semanticThreshold: '0.95',
      injectionDetection: true,
      outputGuard: true,
      maxIterations: '8',
      timeout: '60s',
    });
    expect(withProfile(withProfile(defaultForm(), 'production'), 'minimal')).toEqual(defaultForm());
  });

  it('adds no semantic cache for a provider without embeddings', () => {
    const form = withProfile({ ...defaultForm(), provider: 'anthropic', model: 'claude-sonnet-5' }, 'production');

    expect(form.semanticCache).toBe(false);
    expect(formToYaml(form)).not.toContain('cache:');
  });

  it('reads back a production agent with its own choices', () => {
    const yaml = `agent:
  name: vault
  profile: production
  model:
    provider: ollama
    name: llama3.1
  memory:
    retention: 7d
  security:
    piiMasking: false
    outputGuard: false
  cache:
    exact: redis
    semantic:
      threshold: 0.9
      scope: user
  limits:
    timeout: 30s
  gdpr:
    erasureEndpoint: false
`;
    const result = formFromYaml(yaml);
    if (!result.ok) throw new Error(result.errors.join('\n'));

    expect(result.form).toMatchObject({
      profile: 'production',
      retention: '7d',
      piiMasking: false,
      logsWithoutPii: true,
      erasure: false,
      semanticCache: true,
      semanticThreshold: '0.9',
      injectionDetection: true,
      outputGuard: false,
      maxIterations: '8',
      timeout: '30s',
    });
    expect(formToYaml(result.form)).toBe(yaml);
    expect(validateForm(result.form).errors).toEqual({});
  });

  it('turns the semantic cache off on its own', () => {
    expect(formToYaml({ ...withProfile(defaultForm(), 'production'), semanticCache: false })).toContain(
      'cache:\n    exact: redis\n',
    );
  });

  it('reports a retention or a threshold that is not valid on its field', () => {
    const form = { ...withProfile(defaultForm(), 'production'), retention: 'a month', semanticThreshold: '2' };

    expect(Object.keys(validateForm(form).errors)).toEqual(['retention', 'semanticThreshold']);
  });

  it('keeps a fallback model, a routing and summaries', () => {
    const yaml = `agent:
  name: desk
  model:
    provider: mistral
    name: mistral-medium-latest
    routing:
      strategy: rules
      simple: mistral-small-latest
      complex: mistral-medium-latest
    fallback:
      provider: ollama
      name: qwen2.5:3b
  memory:
    summarize: true
`;
    const result = formFromYaml(yaml);
    if (!result.ok) throw new Error(result.errors.join('\n'));

    expect(result.form).toMatchObject({
      fallbackProvider: 'ollama',
      fallbackModel: 'qwen2.5:3b',
      routing: 'rules',
      routingSimple: 'mistral-small-latest',
      routingComplex: 'mistral-medium-latest',
      summarize: true,
    });
    expect(formToYaml(result.form)).toBe(yaml);
  });

  it('reports a fallback without a model on its field', () => {
    const form = { ...defaultForm(), fallbackProvider: 'ollama' as const, fallbackModel: '' };

    expect(Object.keys(validateForm(form).errors)).toEqual(['fallbackModel']);
  });

  it('keeps tools that wait for approval and the kill switches', () => {
    const yaml = `agent:
  name: vault
  profile: production
  model:
    provider: mistral
    name: mistral-small-latest
  tools:
    - name: block-card
      type: java
      approval:
        required: true
        expiresAfter: 1h
    - name: wire
      type: java
      approval:
        required: true
  security:
    killSwitches: false
`;
    const result = formFromYaml(yaml);
    if (!result.ok) throw new Error(result.errors.join('\n'));

    expect(result.form.killSwitches).toBe(false);
    expect(result.form.tools.map((tool) => [tool.approval, tool.approvalExpiresAfter])).toEqual([
      [true, '1h'],
      [true, ''],
    ]);
    expect(formToYaml(result.form)).toBe(yaml);
    expect(withProfile(defaultForm(), 'production').killSwitches).toBe(true);
  });

  it('keeps a knowledge base, and reports its settings on their fields', () => {
    const yaml = `agent:
  name: docs
  model:
    provider: ollama
    name: qwen2.5:3b
  rag:
    enabled: true
    topK: 3
    rerank: true
`;
    const result = formFromYaml(yaml);
    if (!result.ok) throw new Error(result.errors.join('\n'));

    expect(result.form).toMatchObject({ rag: true, ragTopK: '3', ragRerank: true, ragChunkSize: '' });
    expect(formToYaml(result.form)).toBe(yaml);
    expect(Object.keys(validateForm({ ...result.form, ragTopK: '0', ragChunkSize: 'big' }).errors).sort()).toEqual([
      'ragChunkSize',
      'ragTopK',
    ]);
  });

  it('keeps the evaluations, the dashboard and the Helm chart', () => {
    expect(withProfile(defaultForm(), 'production')).toMatchObject({
      evals: true,
      evalsDataset: 'evals/golden.yaml',
      redTeam: true,
      grafanaDashboard: true,
      helm: true,
    });
    expect(formToYaml(withProfile(defaultForm(), 'production'))).not.toMatch(/evals|deploy|grafana/);

    const yaml = `agent:
  name: desk
  profile: standard
  model:
    provider: mistral
    name: mistral-small-latest
  observability:
    otel: true
    metrics: prometheus
    grafanaDashboard: true
  evals:
    dataset: evals/cases.yaml
    redTeam: true
  deploy:
    - docker-compose
    - helm
`;
    const result = formFromYaml(yaml);
    if (!result.ok) throw new Error(result.errors.join('\n'));

    expect(result.form).toMatchObject({
      evals: true,
      evalsDataset: 'evals/cases.yaml',
      redTeam: true,
      grafanaDashboard: true,
      helm: true,
    });
    expect(formToYaml(result.form)).toBe(yaml);
  });

  it('keeps conversations in Redis', () => {
    const yaml = 'agent:\n  name: desk\n  model:\n    provider: ollama\n    name: m\n  memory:\n    type: redis\n';
    const result = formFromYaml(yaml);
    if (!result.ok) throw new Error(result.errors.join('\n'));

    expect(result.form.memoryType).toBe('redis');
    expect(formToYaml(result.form)).toBe(yaml);
  });

  it('limits any agent when asked, and reports limits that are not valid on their field', () => {
    expect(formToYaml({ ...defaultForm(), maxIterations: '5', timeout: '20s' })).toContain(
      'limits:\n    maxIterations: 5\n    timeout: 20s\n',
    );
    const form = { ...defaultForm(), maxIterations: '0', timeout: 'soon' };

    expect(Object.keys(validateForm(form).errors).sort()).toEqual(['maxIterations', 'timeout']);
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
      'agent:\n  name: big\n  model: { provider: mistral, name: m }\n  observability: { feedback: true }\n',
    );

    expect(result).toEqual({
      ok: false,
      errors: ['agent.observability.feedback: feedback buttons arrive in a later version'],
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
