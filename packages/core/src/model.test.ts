import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildModel, unsupportedFeatures } from './model.js';
import { validateAgentYaml } from './validate.js';
import type { AgentFile } from './schema.js';

function parse(yaml: string): AgentFile {
  const result = validateAgentYaml(yaml);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.config;
}

const assistant = parse(`
agent:
  name: hr-assistant
  model:
    provider: mistral
    name: mistral-large-latest
    temperature: 0.3
    maxTokens: 2000
  tools:
    - name: weather-forecast
      type: http
      description: Weather forecast
      url: https://api.open-meteo.com/v1/forecast
      params:
        - { name: latitude, type: number, required: true }
        - { name: days, type: integer }
    - name: book-leave
      type: java
      description: Books a day off
      params:
        - { name: date, type: string, required: true }
        - { name: halfDay, type: boolean }
`);

describe('buildModel', () => {
  it('derives Maven coordinates, the Java package and the application class from the agent name', () => {
    const model = buildModel(assistant);

    expect(model.project).toEqual({
      artifactId: 'hr-assistant',
      groupId: 'com.example',
      basePackage: 'com.example.hrassistant',
      basePackagePath: 'com/example/hrassistant',
      generatedPackage: 'com.example.hrassistant.generated',
      applicationClass: 'HrAssistantApplication',
    });
  });

  it('uses agent.package when given, and its parent as Maven groupId', () => {
    const model = buildModel(
      parse('agent:\n  name: bot\n  package: io.acme.hr.bot\n  model: { provider: ollama, name: llama3.1 }\n'),
    );

    expect(model.project).toMatchObject({
      groupId: 'io.acme.hr',
      basePackage: 'io.acme.hr.bot',
      applicationClass: 'BotApplication',
    });
  });

  it('maps each provider to its starter, its non-deprecated properties and its API key variable', () => {
    expect(buildModel(assistant).provider).toEqual({
      id: 'mistral',
      starter: 'spring-ai-starter-model-mistral-ai',
      propertyPrefix: 'spring.ai.mistralai',
      configKey: 'mistralai',
      apiKeyEnv: 'MISTRAL_API_KEY',
      maxTokensProperty: 'max-tokens',
      module: 'spring-ai-mistral-ai',
      retries: 'spring',
      model: 'mistral-large-latest',
      temperature: 0.3,
      maxTokens: 2000,
    });

    const ollama = buildModel(
      parse('agent:\n  name: bot\n  model: { provider: ollama, name: llama3.1, maxTokens: 500 }\n'),
    );
    expect(ollama.provider).toMatchObject({ apiKeyEnv: undefined, maxTokensProperty: 'num-predict' });
  });

  it('names tools the way a Java developer would, with boxed Java types: the model may omit any argument', () => {
    const [http, java] = buildModel(assistant).tools;

    expect(http).toMatchObject({
      kind: 'http',
      className: 'WeatherForecastTool',
      methodName: 'weatherForecast',
      firstRequiredParam: 'latitude',
      method: 'GET',
      clientMethod: 'get',
      sendsBody: false,
      url: 'https://api.open-meteo.com/v1/forecast',
      params: [
        { name: 'latitude', javaType: 'Double', required: true, sample: '1.0' },
        { name: 'days', javaType: 'Long', required: false, sample: 'null' },
      ],
    });
    expect(java).toMatchObject({
      kind: 'java',
      className: 'BookLeaveTool',
      handlerInterface: 'BookLeaveHandler',
      handlerClass: 'DefaultBookLeaveHandler',
      methodName: 'bookLeave',
      params: [
        { name: 'date', javaType: 'String', required: true, sample: '"test"' },
        { name: 'halfDay', javaType: 'Boolean', required: false, sample: 'null' },
      ],
    });
  });

  it('splits HTTP parameters by placement, and carries authentication and the response limit', () => {
    const model = buildModel(
      parse(`
agent:
  name: shop-assistant
  model: { provider: ollama, name: llama3.1 }
  tools:
    - name: order-status
      type: http
      url: https://shop.example.org/api/orders/{orderId}
      auth: { type: bearer, env: SHOP_API_TOKEN }
      params:
        - { name: orderId, type: string, required: true }
        - { name: verbose, type: boolean }
    - name: create-note
      type: http
      method: POST
      url: https://shop.example.org/api/orders/{orderId}/notes
      auth: { type: header, name: X-API-Key, env: SHOP_API_KEY }
      maxResponseChars: 5000
      params:
        - { name: orderId, type: string, required: true }
        - { name: text, type: string, required: true }
`),
    );
    const [lookup, note] = model.tools;

    expect(lookup).toMatchObject({
      urlTemplate: true,
      pathParams: [{ name: 'orderId' }],
      queryParams: [{ name: 'verbose' }],
      bodyParams: [],
      sendsBody: false,
      auth: { kind: 'bearer', header: 'Authorization', env: 'SHOP_API_TOKEN' },
      maxResponseChars: 20000,
      sampleUrl: 'https://shop.example.org/api/orders/test',
    });
    expect(note).toMatchObject({
      pathParams: [{ name: 'orderId' }],
      queryParams: [],
      bodyParams: [{ name: 'text' }],
      sendsBody: true,
      auth: { kind: 'header', header: 'X-API-Key', env: 'SHOP_API_KEY' },
      maxResponseChars: 5000,
      sampleBodyJson: '{"text":"test"}',
    });
    // Tests set the tokens themselves: the environment variables are only needed to run the agent.
    expect(model.secrets).toEqual(['SHOP_API_TOKEN', 'SHOP_API_KEY']);
    expect(model.testProperties).toEqual([
      'agent.tools.order-status.token=test-token',
      'agent.tools.create-note.token=test-token',
    ]);
  });

  it('keeps the name the API uses when it differs from the Java name', () => {
    const [search] = buildModel(
      parse(`
agent:
  name: hr-assistant
  model: { provider: ollama, name: llama3.1 }
  tools:
    - name: create-leave
      type: http
      method: POST
      url: https://hr.example.org/api/leaves
      params:
        - { name: employeeId, apiName: employee_id, type: string, required: true, in: query }
        - { name: startDate, apiName: start_date, type: string, required: true }
`),
    ).tools;

    expect(search).toMatchObject({
      queryParams: [{ name: 'employeeId', apiName: 'employee_id' }],
      bodyParams: [{ name: 'startDate', apiName: 'start_date' }],
      sampleBodyJson: '{"start_date":"test"}',
    });
  });

  it('pins the Spring Boot version Spring AI depends on, and flags which kinds of tools exist', () => {
    const model = buildModel(assistant);

    expect(model.versions).toEqual({
      springBoot: '4.1.1',
      springAi: '2.0.1',
      bucket4j: '8.21.0',
      resilience4j: '2.4.0',
    });
    expect(model.features).toEqual({
      httpTools: true,
      javaTools: true,
      jdbcMemory: false,
      oidc: false,
      limits: false,
      dockerCompose: false,
      cache: false,
      redis: false,
      otel: false,
      prometheus: false,
      mcp: false,
      trackToolCalls: false,
      guardTools: false,
      chatUi: false,
      pii: false,
      logsWithoutPii: false,
      erasure: false,
      retention: false,
      semanticCache: false,
      vectorStore: false,
      postgres: false,
      rag: false,
      injectionDetection: false,
      outputGuard: false,
      requestTimeout: false,
      resilience: false,
      routing: false,
      summarize: false,
      approval: false,
      killSwitches: false,
      adminRole: false,
      evals: false,
      redTeam: false,
      grafanaDashboard: false,
      helm: false,
    });
  });

  it('keeps the system prompt as a classpath resource and the memory window', () => {
    const model = buildModel(assistant);

    expect(model.prompt).toEqual({ resource: 'prompts/system.md', aiDisclosure: true });
    expect(model.memory).toEqual({ window: 20, jdbc: false });
  });
});

describe('buildModel with the standard profile', () => {
  const standard = parse(`
agent:
  name: support-desk
  profile: standard
  model: { provider: mistral, name: mistral-small-latest }
`);

  it('turns on the JDBC memory, OIDC, the limits and Docker Compose', () => {
    expect(buildModel(standard).features).toMatchObject({
      jdbcMemory: true,
      oidc: true,
      limits: true,
      dockerCompose: true,
    });
  });

  it('turns the limits into Bucket4j capacities and Spring durations', () => {
    expect(buildModel(standard).limits).toEqual({
      requests: { capacity: 30, period: '1m', unit: 'minute' },
      tokens: { capacity: 100000, period: '1d', unit: 'day' },
    });
  });

  it('caches first answers and exports traces and metrics', () => {
    expect(buildModel(standard).features).toMatchObject({ cache: true, redis: true, otel: true, prometheus: true });
  });

  it('runs MCP servers with npx or uvx, or inside Docker when sandboxed, with only the variables they name', () => {
    const { mcpServers, secrets, testProperties } = buildModel(
      parse(`
agent:
  name: tools-agent
  model: { provider: ollama, name: llama3.1 }
  mcp:
    - { name: github, package: "@modelcontextprotocol/server-github", version: 2025.4.8, runtime: node, env: [GITHUB_TOKEN] }
    - { name: files, package: "@modelcontextprotocol/server-filesystem", version: 2025.8.21, runtime: node, sandbox: none, args: [/srv/docs] }
    - { name: fetch, package: mcp-server-fetch, version: 2025.4.7, runtime: python, sandbox: none }
`),
    );

    expect(mcpServers).toEqual([
      {
        name: 'github',
        command: 'docker',
        args: [
          'run',
          '--interactive',
          '--rm',
          '--env',
          'GITHUB_TOKEN',
          'node:22.23.4-alpine',
          'npx',
          '--yes',
          '@modelcontextprotocol/server-github@2025.4.8',
        ],
        env: ['GITHUB_TOKEN'],
        sandboxed: true,
      },
      {
        name: 'files',
        command: 'npx',
        args: ['--yes', '@modelcontextprotocol/server-filesystem@2025.8.21', '/srv/docs'],
        env: [],
        sandboxed: false,
      },
      { name: 'fetch', command: 'uvx', args: ['mcp-server-fetch==2025.4.7'], env: [], sandboxed: false },
    ]);
    expect(secrets).toContain('GITHUB_TOKEN');
    // The tests start no MCP server: they would download packages and need the network.
    expect(testProperties).toContain('spring.ai.mcp.client.enabled=false');
  });

  it('serves a chat page when the interface asks for it', () => {
    const withUi = parse(`
agent:
  name: support-desk
  profile: standard
  interface: [rest, chat-ui]
  model: { provider: mistral, name: mistral-small-latest }
`);

    expect(buildModel(withUi).features.chatUi).toBe(true);
    expect(unsupportedFeatures(withUi)).toEqual([]);
  });

  it('masks personal data, erases and purges it, and caches by meaning in pgvector with the provider embeddings', () => {
    const production = buildModel(
      parse(
        'agent:\n  name: vault\n  profile: production\n  model: { provider: mistral, name: mistral-small-latest }\n',
      ),
    );

    expect(production.features).toMatchObject({
      pii: true,
      logsWithoutPii: true,
      erasure: true,
      retention: true,
      semanticCache: true,
      vectorStore: true,
      redis: true,
    });
    expect(production.retention).toBe('30d');
    expect(production.semanticCache).toEqual({ threshold: 0.95 });
    expect(production.embedding).toEqual({ model: 'mistral-embed', dimensions: 1024 });
    expect(
      unsupportedFeatures(
        parse('agent:\n  name: vault\n  profile: production\n  model: { provider: mistral, name: m }\n'),
      ),
    ).toEqual([]);
  });

  it('guards the input, the tools and the output of a production agent', () => {
    const production = buildModel(
      parse(`
agent:
  name: vault
  profile: production
  model: { provider: mistral, name: mistral-small-latest }
  tools:
    - { name: rates, type: http, url: https://bank.example.org/rates }
    - { name: transfer, type: http, method: POST, url: https://bank.example.org/transfers }
    - { name: notes, type: java }
`),
    );

    expect(production.features).toMatchObject({
      injectionDetection: true,
      outputGuard: true,
      guardTools: true,
      requestTimeout: true,
    });
    expect(production.loop).toEqual({ maxIterations: 8, timeout: '60s' });
    // Once a tool result held instructions, only the tools that read data stay callable.
    expect(production.readOnlyTools).toEqual(['rates']);
    expect(production.secretPatterns).toContain('AKIA[0-9A-Z]{16}');
  });

  it('falls back to another provider, routes between two models and summarizes old messages', () => {
    const resilient = buildModel(
      parse(`
agent:
  name: desk
  profile: production
  model:
    provider: mistral
    name: mistral-large-latest
    routing: { strategy: rules, simple: mistral-small-latest, complex: mistral-large-latest }
    fallback: { provider: openai, name: gpt-5-mini }
  memory: { summarize: true }
`),
    );

    expect(resilient.features).toMatchObject({ resilience: true, routing: true, summarize: true });
    expect(resilient.fallback).toEqual({
      provider: 'openai',
      model: 'gpt-5-mini',
      sameProvider: false,
      module: 'spring-ai-openai',
      apiKeyEnv: 'OPENAI_API_KEY',
    });
    expect(resilient.routing).toEqual({
      strategy: 'rules',
      simple: 'mistral-small-latest',
      complex: 'mistral-large-latest',
    });
    expect(resilient.provider.retries).toBe('spring');
    expect(resilient.secrets).toEqual(['MISTRAL_API_KEY', 'OPENAI_API_KEY']);
    expect(resilient.testProperties).toContain('agent.fallback.api-key=test-key');
  });

  it('keeps one provider when the fallback is another model of it', () => {
    const sameProvider = buildModel(
      parse(`
agent:
  name: desk
  model:
    provider: ollama
    name: qwen2.5:7b
    fallback: { provider: ollama, name: qwen2.5:3b }
`),
    );

    expect(sameProvider.features.resilience).toBe(true);
    expect(sameProvider.fallback).toMatchObject({ sameProvider: true, apiKeyEnv: undefined });
    expect(sameProvider.secrets).toEqual([]);
    expect(sameProvider.ollamaModels).toEqual(['qwen2.5:7b', 'qwen2.5:3b']);
  });

  it('waits for the approval of the user before a sensitive call, and lets administrators switch things off', () => {
    const controlled = buildModel(
      parse(`
agent:
  name: vault
  profile: production
  model: { provider: mistral, name: mistral-small-latest }
  tools:
    - { name: rates, type: http, url: https://bank.example.org/rates }
    - name: block-card
      type: java
      approval: { required: true }
    - name: wire
      type: http
      method: POST
      url: https://bank.example.org/wires
      approval: { required: true, expiresAfter: 1h }
`),
    );

    expect(controlled.features).toMatchObject({
      approval: true,
      killSwitches: true,
      adminRole: true,
      guardTools: true,
    });
    expect(controlled.approvalTools).toEqual([
      { name: 'blockCard', expiresAfter: '24h' },
      { name: 'wire', expiresAfter: '1h' },
    ]);
    expect(controlled.toolNames).toEqual(['rates', 'blockCard', 'wire']);
  });

  it('answers from documents indexed in pgvector, Postgres running even with conversations in memory', () => {
    const rag = buildModel(
      parse(`
agent:
  name: helpdesk
  model: { provider: ollama, name: qwen2.5:3b }
  rag: { enabled: true, topK: 3, rerank: true }
`),
    );

    expect(rag.features).toMatchObject({ rag: true, vectorStore: true, postgres: true, jdbcMemory: false });
    expect(rag.rag).toEqual({ topK: 3, rerank: true, chunkSize: 500 });
    expect(rag.embedding).toEqual({ model: 'nomic-embed-text', dimensions: 768 });
    expect(rag.ollamaModels).toEqual(['qwen2.5:3b', 'nomic-embed-text']);
    expect(
      unsupportedFeatures(
        parse('agent:\n  name: h\n  model: { provider: ollama, name: m }\n  rag: { enabled: true }\n'),
      ),
    ).toEqual([]);
  });

  it('evaluates a production agent on Ollama, ships its dashboard and a Helm chart', () => {
    const production = buildModel(
      parse(
        'agent:\n  name: vault\n  profile: production\n  model: { provider: mistral, name: mistral-small-latest }\n',
      ),
    );

    expect(production.features).toMatchObject({ evals: true, redTeam: true, grafanaDashboard: true, helm: true });
    expect(production.evals).toEqual({ dataset: 'evals/golden.yaml', redTeam: true, model: 'qwen2.5:3b' });

    const local = buildModel(
      parse(
        'agent:\n  name: desk\n  model: { provider: ollama, name: qwen2.5:3b }\n  evals: { dataset: evals/cases.yaml }\n',
      ),
    );
    expect(local.evals).toEqual({ dataset: 'evals/cases.yaml', redTeam: false, model: 'qwen2.5:3b' });
    expect(local.features).toMatchObject({ evals: true, redTeam: false, helm: false, grafanaDashboard: false });
  });

  it('limits the tool calls of an agent that only asks for it', () => {
    const limited = buildModel(
      parse(`
agent:
  name: desk
  model: { provider: ollama, name: m }
  tools: [{ name: clock, type: java }]
  limits: { maxIterations: 3 }
`),
    );

    // Spring AI counts the tool calls itself.
    expect(limited.features).toMatchObject({ guardTools: false, requestTimeout: false, injectionDetection: false });
    expect(limited.loop).toEqual({ maxIterations: 3, timeout: undefined });
  });

  it('gives the tests an issuer they never call: requests carry their own token', () => {
    expect(buildModel(standard).testProperties).toContain(
      'spring.security.oauth2.resourceserver.jwt.issuer-uri=https://issuer.example.org',
    );
  });
});

describe('unsupportedFeatures', () => {
  it('accepts everything the minimal profile generates', () => {
    expect(unsupportedFeatures(assistant)).toEqual([]);
  });

  it('accepts the standard profile', () => {
    expect(
      unsupportedFeatures(parse('agent:\n  name: desk\n  profile: standard\n  model: { provider: ollama, name: m }\n')),
    ).toEqual([]);
  });

  it('lists what V1 cannot generate yet, with the version that brings it', () => {
    const dossier = parse(readFileSync(new URL('./__fixtures__/spec-example.yaml', import.meta.url), 'utf8'));

    expect(unsupportedFeatures(dossier)).toEqual(
      expect.arrayContaining([
        'agent.springAi: 1.0.0 is not supported, this version of gen-agent generates Spring AI 2.0.1',
        'agent.tools.0.cacheTtl: caching tool results arrives in a later version',
        'agent.openapi: the specs must be read first: gen-agent generate does it (the web generator imports a spec with "Import OpenAPI")',
        'agent.observability.feedback: feedback buttons arrive in a later version',
      ]),
    );
  });
});
