import fc from 'fast-check';

/**
 * Random agent.yaml files over the whole format, for property tests: most of them are valid, the rules of core turn
 * the others down. Names and values include the awkward ones (short names, digits, Java-looking words).
 */
const providers = ['openai', 'anthropic', 'mistral', 'ollama'] as const;
const models: Record<(typeof providers)[number], string[]> = {
  openai: ['gpt-5-mini', 'gpt-5'],
  anthropic: ['claude-haiku-4-5', 'claude-sonnet-5'],
  mistral: ['mistral-small-latest', 'mistral-large-latest'],
  ollama: ['qwen2.5:7b', 'llama3.1'],
};
const kebab = fc.constantFrom('a', 'x2', 'agent', 'order-status', 'get-v2-items', 'list', 'book-day-off', 'send');
const durations = fc.constantFrom('30s', '10m', '24h', '30d');
const optional = <T>(value: fc.Arbitrary<T>): fc.Arbitrary<T | undefined> =>
  fc.option(value, { nil: undefined, freq: 2 });
const env = fc.constantFrom('API_TOKEN', 'SHOP_KEY', 'X_1');

/** Drops the keys whose value is undefined, as a person would leave them out of agent.yaml. */
function compact<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

const param = fc.record({
  name: fc.constantFrom('id', 'orderId', 'date', 'amount', 'q', 'limit', 'value2'),
  type: fc.constantFrom('string', 'number', 'integer', 'boolean'),
  required: fc.boolean(),
  description: optional(fc.constantFrom('the id', 'a date, YYYY-MM-DD', 'how many: at most 50')),
});

const httpTool = fc
  .record({
    name: kebab,
    type: fc.constant('http' as const),
    description: optional(fc.constantFrom('Finds items', 'Creates an order')),
    method: optional(fc.constantFrom('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
    url: fc.constantFrom(
      'https://api.example.org/items',
      'https://api.example.org/orders/{id}',
      'http://localhost:9000/x',
    ),
    params: fc.uniqueArray(param, { maxLength: 3, selector: (p) => p.name }),
    auth: optional(
      fc.oneof(
        fc.record({ type: fc.constant('bearer' as const), env }),
        fc.record({ type: fc.constant('header' as const), name: fc.constant('X-API-Key'), env }),
      ),
    ),
    maxResponseChars: optional(fc.constantFrom(500, 20000)),
    cacheTtl: optional(durations),
    approval: optional(fc.record({ required: fc.boolean(), expiresAfter: optional(durations) }).map(compact)),
  })
  .map((tool) => {
    // A path placeholder needs its parameter: give it one, as the rules ask.
    const params =
      tool.url.includes('{id}') && !tool.params.some((p) => p.name === 'id')
        ? [...tool.params, { name: 'id', type: 'string', required: true, description: undefined }]
        : tool.params;
    return compact({ ...tool, params: params.map(compact) });
  });

const javaTool = fc
  .record({
    name: kebab,
    type: fc.constant('java' as const),
    description: optional(fc.constantFrom('Books a day off', 'Refunds an order')),
    params: fc.uniqueArray(param, { maxLength: 3, selector: (p) => p.name }),
    approval: optional(fc.record({ required: fc.boolean(), expiresAfter: optional(durations) }).map(compact)),
  })
  .map((tool) => compact({ ...tool, params: tool.params.map(compact) }));

const mcpServer = fc.oneof(
  fc
    .record({
      name: fc.constantFrom('files', 'time', 'git2'),
      package: fc.constantFrom('@modelcontextprotocol/server-filesystem', 'mcp-server-time'),
      version: fc.constantFrom('2026.1.14', '1.0.0'),
      runtime: fc.constantFrom('node', 'python'),
      sandbox: optional(fc.constantFrom('docker', 'none')),
      args: optional(fc.constantFrom(['/data'], ['--local-timezone', 'Europe/Paris'])),
      env: optional(fc.constantFrom(['GITHUB_TOKEN'], ['A', 'B_2'])),
      network: optional(fc.boolean()),
    })
    .map(compact),
  fc
    .record({
      name: fc.constantFrom('remote', 'search'),
      url: fc.constantFrom('https://mcp.example.org/mcp', 'http://localhost:3001/mcp'),
      auth: optional(fc.record({ type: fc.constant('bearer' as const), env })),
    })
    .map(compact),
);

export const arbitraryAgent = fc
  .record({
    name: fc.constantFrom('a', 'bot', 'support-desk', 'x2-y3', 'order-api-v2', 'class-act'),
    description: optional(fc.constantFrom('Helps "customers"', "L'assistant RH", 'Line one: ok')),
    package: optional(fc.constantFrom('io.acme.bot', 'org.example.agents.v2')),
    profile: optional(fc.constantFrom('minimal', 'standard', 'production')),
    build: optional(fc.constantFrom('maven', 'gradle')),
    provider: fc.constantFrom(...providers),
    temperature: optional(fc.constantFrom(0, 0.7)),
    maxTokens: optional(fc.constantFrom(500, 4000)),
    routing: optional(fc.constantFrom('rules', 'classifier')),
    fallback: optional(fc.constantFrom(...providers)),
    aiDisclosure: optional(fc.boolean()),
    memory: optional(
      fc
        .record({
          type: optional(fc.constantFrom('in-memory', 'jdbc', 'redis')),
          window: optional(fc.constantFrom(4, 20)),
          summarize: optional(fc.boolean()),
          retention: optional(durations),
        })
        .map(compact),
    ),
    tools: fc.uniqueArray(fc.oneof(httpTool, javaTool), { maxLength: 4, selector: (tool) => tool.name }),
    mcp: optional(fc.uniqueArray(mcpServer, { minLength: 1, maxLength: 2, selector: (server) => server.name })),
    rag: optional(
      fc
        .record({
          enabled: fc.boolean(),
          topK: optional(fc.constantFrom(2, 8)),
          rerank: optional(fc.boolean()),
          chunkSize: optional(fc.constantFrom(200, 800)),
        })
        .map(compact),
    ),
    security: optional(
      fc
        .record({
          auth: optional(fc.constantFrom('none', 'oidc')),
          rateLimit: optional(fc.constantFrom('30/min', '5/sec')),
          tokenBudget: optional(fc.constantFrom('100000/day')),
          piiMasking: optional(fc.boolean()),
          injectionDetection: optional(fc.boolean()),
          outputGuard: optional(fc.boolean()),
          killSwitches: optional(fc.boolean()),
        })
        .map(compact),
    ),
    cache: optional(
      fc
        .record({
          exact: optional(fc.constantFrom('none', 'redis')),
          semantic: optional(fc.record({ threshold: fc.constantFrom(0.9, 0.97) })),
        })
        .map(compact),
    ),
    limits: optional(
      fc.record({ maxIterations: optional(fc.constantFrom(1, 8)), timeout: optional(durations) }).map(compact),
    ),
    observability: optional(
      fc
        .record({
          otel: optional(fc.boolean()),
          metrics: optional(fc.constantFrom('none', 'prometheus')),
          grafanaDashboard: optional(fc.boolean()),
          feedback: optional(fc.boolean()),
        })
        .map(compact),
    ),
    gdpr: optional(
      fc
        .record({
          euOnly: optional(fc.boolean()),
          allowNonEuProviders: optional(fc.boolean()),
          erasureEndpoint: optional(fc.boolean()),
          logsWithoutPii: optional(fc.boolean()),
        })
        .map(compact),
    ),
    evals: optional(
      fc.record({ dataset: optional(fc.constant('evals/golden.yaml')), redTeam: optional(fc.boolean()) }).map(compact),
    ),
    interface: optional(fc.constantFrom(['rest'], ['rest', 'chat-ui'])),
    deploy: optional(fc.constantFrom(['docker-compose'], ['helm'], ['docker-compose', 'helm'])),
  })
  .map(({ provider, temperature, maxTokens, routing, fallback, aiDisclosure, ...agent }) => ({
    agent: compact({
      ...agent,
      model: compact({
        provider,
        name: models[provider][0],
        temperature,
        maxTokens,
        routing:
          routing === undefined
            ? undefined
            : { strategy: routing, simple: models[provider][0], complex: models[provider][1] },
        fallback: fallback === undefined ? undefined : { provider: fallback, name: models[fallback][1] },
      }),
      prompt: aiDisclosure === undefined ? undefined : { aiDisclosure },
    }),
  }));
