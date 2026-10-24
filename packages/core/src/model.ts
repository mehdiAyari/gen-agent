import {
  placementOf,
  SUPPORTED_SPRING_AI,
  SUPPORTED_SPRING_BOOT,
  urlPlaceholders,
  type AgentDefinition,
  type AgentFile,
  type Provider,
  type Tool,
  type ToolParamType,
} from './schema.js';

/** Everything templates need, already derived: they only read this model, they never compute names. */
export interface GenerationModel {
  agent: AgentDefinition;
  project: {
    artifactId: string;
    groupId: string;
    basePackage: string;
    basePackagePath: string;
    generatedPackage: string;
    applicationClass: string;
  };
  versions: { springBoot: string; springAi: string; bucket4j: string };
  /** Docker images of the services, pinned: the same in the tests and in Docker Compose. */
  images: typeof IMAGES;
  features: {
    httpTools: boolean;
    javaTools: boolean;
    /** Conversations kept in Postgres through Spring AI's JDBC repository. */
    jdbcMemory: boolean;
    /** Requests carry a JWT from an OIDC provider; conversations belong to their user. */
    oidc: boolean;
    /** Request rate and token budget per user, counted in Redis. */
    limits: boolean;
    dockerCompose: boolean;
    /** First answers of a conversation kept in Redis per user, unless a tool was called. */
    cache: boolean;
    /** Redis is needed: for the limits or the cache. */
    redis: boolean;
    /** Traces and metrics exported over OTLP. */
    otel: boolean;
    /** Metrics scraped at /actuator/prometheus. */
    prometheus: boolean;
    mcp: boolean;
    /** Tools report their calls, so that answers built from live data are not cached. */
    trackToolCalls: boolean;
    /** A chat page served by the agent; with OIDC, users sign in from the browser. */
    chatUi: boolean;
  };
  /** MCP servers the agent starts and whose tools it gives the model. */
  mcpServers: McpServer[];
  /** Per user; absent when not limited. */
  limits: { requests?: Limit; tokens?: Limit };
  provider: ProviderSettings;
  prompt: { resource: string; aiDisclosure: boolean };
  memory: { window: number; jdbc: boolean };
  tools: ModelTool[];
  /** Properties the generated tests set instead of environment variables (API keys, tool tokens). */
  testProperties: string[];
  /** Environment variables the agent needs to run, without duplicates: the provider API key, then tool tokens. */
  secrets: string[];
}

export interface ProviderSettings {
  id: Provider;
  starter: string;
  propertyPrefix: string;
  /** Last segment of the prefix: the provider key under `spring.ai` in application.yml. */
  configKey: string;
  /** Environment variable holding the API key; undefined for self-hosted providers. */
  apiKeyEnv: string | undefined;
  maxTokensProperty: string;
  model: string;
  temperature: number | undefined;
  maxTokens: number | undefined;
}

export interface ToolParameter {
  name: string;
  javaType: string;
  required: boolean;
  description: string | undefined;
  /** A Java literal of this type, used by the generated tests. */
  sample: string;
  /** The sample as it appears in a URL or a JSON body: test, 1.0, 1, true. */
  sampleText: string;
  /** HTTP tools: the name in the query or the JSON body, when it differs from the Java name. */
  apiName: string | undefined;
}

interface ModelToolBase {
  name: string;
  className: string;
  methodName: string;
  description: string | undefined;
  params: ToolParameter[];
  /** Name of the first required parameter, used by the generated test of a missing argument. */
  firstRequiredParam: string | undefined;
}

export type ModelTool =
  | (ModelToolBase & {
      kind: 'http';
      method: string;
      /** RestClient method: get, post… */
      clientMethod: string;
      /** True when some parameters go in a JSON body. */
      sendsBody: boolean;
      url: string;
      /** The URL has `{name}` placeholders, filled from path parameters. */
      urlTemplate: boolean;
      pathParams: ToolParameter[];
      queryParams: ToolParameter[];
      bodyParams: ToolParameter[];
      /** Header sent with every call, its value read from an environment variable. */
      auth: HttpAuth | undefined;
      maxResponseChars: number;
      /** The URL the generated test expects, placeholders filled with the sample values. */
      sampleUrl: string;
      /** JSON body the generated test expects: the required body parameters with their sample values. */
      sampleBodyJson: string;
    })
  | (ModelToolBase & {
      kind: 'java';
      /** Generated interface the tool delegates to. */
      handlerInterface: string;
      /** User-owned implementation, created once and never rewritten. */
      handlerClass: string;
    });

/** A Bucket4j bandwidth: `capacity` per `period`, a Spring duration (1m, 1d). */
interface Limit {
  capacity: number;
  period: string;
  /** The period in words, for the README: second, minute, hour, day. */
  unit: string;
}

const PERIODS: Record<string, { period: string; unit: string }> = {
  sec: { period: '1s', unit: 'second' },
  min: { period: '1m', unit: 'minute' },
  hour: { period: '1h', unit: 'hour' },
  day: { period: '1d', unit: 'day' },
};

/** 30/min → 30 per 1m. */
function limitOf(rate: string | undefined): Limit | undefined {
  const match = rate === undefined ? null : /^(\d+)\/(sec|min|hour|day)$/.exec(rate);
  const period = match === null ? undefined : PERIODS[match[2] ?? ''];
  return match === null || period === undefined ? undefined : { capacity: Number(match[1]), ...period };
}

interface HttpAuth {
  kind: 'bearer' | 'header';
  header: string;
  env: string;
}

interface McpServer {
  name: string;
  command: string;
  args: string[];
  /** Names of the environment variables passed to the server. */
  env: string[];
  /** Runs in a throwaway container: it sees only the variables it names, not the files of the agent. */
  sandboxed: boolean;
}

/** Not managed by Spring Boot: checked on Maven Central (2026-10-24). */
const BUCKET4J_VERSION = '8.21.0';

/** Checked on Docker Hub and Quay (2026-10-24). */
const IMAGES = {
  postgres: 'postgres:18.6-alpine',
  redis: 'redis:8.10.2-alpine',
  keycloak: 'quay.io/keycloak/keycloak:26.8.1',
  jdk: 'eclipse-temurin:21.0.12.1_1-jdk-alpine',
  jre: 'eclipse-temurin:21.0.12.1_1-jre-alpine',
  node: 'node:22.23.4-alpine',
  uv: 'astral/uv:0.13.5-python3.13-alpine',
  lgtm: 'grafana/otel-lgtm:0.38.0',
} as const;

function mcpServerOf(server: NonNullable<AgentDefinition['mcp']>[number]): McpServer {
  const env = server.env ?? [];
  const run =
    server.runtime === 'node'
      ? ['npx', '--yes', `${server.package}@${server.version}`, ...(server.args ?? [])]
      : ['uvx', `${server.package}==${server.version}`, ...(server.args ?? [])];
  if (server.sandbox === 'none') {
    const [command = 'npx', ...args] = run;
    return { name: server.name, command, args, env, sandboxed: false };
  }
  return {
    name: server.name,
    command: 'docker',
    args: [
      'run',
      '--interactive',
      '--rm',
      ...env.flatMap((name) => ['--env', name]),
      server.runtime === 'node' ? IMAGES.node : IMAGES.uv,
      ...run,
    ],
    env,
    sandboxed: true,
  };
}

/** Large enough for a typical JSON answer, small enough to leave room in the model's context. */
export const DEFAULT_MAX_RESPONSE_CHARS = 20_000;

/** Spring AI starter and configuration keys per provider (non-deprecated keys of Spring AI 2.0.1). */
const PROVIDERS: Record<Provider, Omit<ProviderSettings, 'id' | 'model' | 'temperature' | 'maxTokens'>> = {
  openai: {
    starter: 'spring-ai-starter-model-openai',
    propertyPrefix: 'spring.ai.openai',
    configKey: 'openai',
    apiKeyEnv: 'OPENAI_API_KEY',
    maxTokensProperty: 'max-tokens',
  },
  anthropic: {
    starter: 'spring-ai-starter-model-anthropic',
    propertyPrefix: 'spring.ai.anthropic',
    configKey: 'anthropic',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    maxTokensProperty: 'max-tokens',
  },
  mistral: {
    starter: 'spring-ai-starter-model-mistral-ai',
    propertyPrefix: 'spring.ai.mistralai',
    configKey: 'mistralai',
    apiKeyEnv: 'MISTRAL_API_KEY',
    maxTokensProperty: 'max-tokens',
  },
  ollama: {
    starter: 'spring-ai-starter-model-ollama',
    propertyPrefix: 'spring.ai.ollama',
    configKey: 'ollama',
    apiKeyEnv: undefined,
    maxTokensProperty: 'num-predict',
  },
};

/**
 * Arguments come from the model and are untrusted: it may omit even a required one. Boxed types let the tool receive
 * null and answer with a clear error the model can act on, instead of failing the conversion before the call.
 */
const JAVA_TYPES: Record<ToolParamType, { javaType: string; sample: string; sampleText: string }> = {
  string: { javaType: 'String', sample: '"test"', sampleText: 'test' },
  number: { javaType: 'Double', sample: '1.0', sampleText: '1.0' },
  integer: { javaType: 'Long', sample: '1L', sampleText: '1' },
  boolean: { javaType: 'Boolean', sample: 'true', sampleText: 'true' },
};

const pascalCase = (kebab: string): string =>
  kebab
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

const camelCase = (kebab: string): string => {
  const pascal = pascalCase(kebab);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};

export function buildModel(file: AgentFile): GenerationModel {
  const { agent } = file;
  const basePackage = agent.package ?? `com.example.${agent.name.replaceAll('-', '')}`;
  const groupId = basePackage.includes('.') ? basePackage.slice(0, basePackage.lastIndexOf('.')) : basePackage;

  const tools = agent.tools.map((tool) => toolModel(tool));
  const providerSettings = PROVIDERS[agent.model.provider];
  const oidc = agent.security?.auth === 'oidc';
  const requests = limitOf(agent.security?.rateLimit);
  const tokens = limitOf(agent.security?.tokenBudget);
  const cache = agent.cache?.exact === 'redis';
  const mcpServers = (agent.mcp ?? []).map(mcpServerOf);

  return {
    agent,
    project: {
      artifactId: agent.name,
      groupId,
      basePackage,
      basePackagePath: basePackage.replaceAll('.', '/'),
      generatedPackage: `${basePackage}.generated`,
      applicationClass: `${pascalCase(agent.name)}Application`,
    },
    versions: { springBoot: SUPPORTED_SPRING_BOOT, springAi: agent.springAi, bucket4j: BUCKET4J_VERSION },
    images: IMAGES,
    features: {
      httpTools: agent.tools.some((tool) => tool.type === 'http'),
      javaTools: agent.tools.some((tool) => tool.type === 'java'),
      jdbcMemory: agent.memory.type === 'jdbc',
      oidc,
      limits: requests !== undefined || tokens !== undefined,
      dockerCompose: agent.deploy?.includes('docker-compose') ?? false,
      cache,
      redis: requests !== undefined || tokens !== undefined || cache,
      otel: agent.observability?.otel === true,
      prometheus: agent.observability?.metrics === 'prometheus',
      mcp: mcpServers.length > 0,
      trackToolCalls: cache && (agent.tools.length > 0 || mcpServers.length > 0),
      chatUi: agent.interface.includes('chat-ui'),
    },
    mcpServers,
    limits: { ...(requests === undefined ? {} : { requests }), ...(tokens === undefined ? {} : { tokens }) },
    provider: {
      id: agent.model.provider,
      ...providerSettings,
      model: agent.model.name,
      temperature: agent.model.temperature,
      maxTokens: agent.model.maxTokens,
    },
    prompt: { resource: agent.prompt.system, aiDisclosure: agent.prompt.aiDisclosure },
    memory: { window: agent.memory.window, jdbc: agent.memory.type === 'jdbc' },
    tools,
    secrets: [
      ...new Set([
        ...(providerSettings.apiKeyEnv === undefined ? [] : [providerSettings.apiKeyEnv]),
        ...tools.flatMap((tool) => (tool.kind === 'http' && tool.auth !== undefined ? [tool.auth.env] : [])),
        ...mcpServers.flatMap((server) => server.env),
      ]),
    ],
    testProperties: [
      ...(providerSettings.apiKeyEnv === undefined ? [] : [`${providerSettings.propertyPrefix}.api-key=test-key`]),
      ...(oidc ? ['spring.security.oauth2.resourceserver.jwt.issuer-uri=https://issuer.example.org'] : []),
      ...(mcpServers.length > 0 ? ['spring.ai.mcp.client.enabled=false'] : []),
      ...tools.flatMap((tool) =>
        tool.kind === 'http' && tool.auth !== undefined ? [`agent.tools.${tool.name}.token=test-token`] : [],
      ),
    ],
  };
}

function toolModel(tool: Tool): ModelTool {
  const firstRequired = tool.params.find((param) => param.required);
  const base: ModelToolBase = {
    name: tool.name,
    className: `${pascalCase(tool.name)}Tool`,
    methodName: camelCase(tool.name),
    description: tool.description,
    params: tool.params.map((param) => {
      const types = JAVA_TYPES[param.type];
      return {
        name: param.name,
        javaType: types.javaType,
        required: param.required,
        description: param.description,
        sample: param.required ? types.sample : 'null',
        sampleText: types.sampleText,
        apiName: tool.type === 'http' ? param.apiName : undefined,
      };
    }),
    firstRequiredParam: firstRequired?.name,
  };
  if (tool.type === 'http') {
    const placed = (placement: string): ToolParameter[] =>
      base.params.filter((_, i) => {
        const param = tool.params[i];
        return param !== undefined && placementOf(tool, param) === placement;
      });
    const placeholders = urlPlaceholders(tool.url);
    // In the order of the URL: the generated code fills the template positionally.
    const pathParams = placed('path').sort((a, b) => placeholders.indexOf(a.name) - placeholders.indexOf(b.name));
    const bodyParams = placed('body');
    const sampleOf = (name: string): string => pathParams.find((param) => param.name === name)?.sampleText ?? name;
    return {
      ...base,
      kind: 'http',
      method: tool.method,
      clientMethod: tool.method.toLowerCase(),
      sendsBody: bodyParams.length > 0,
      url: tool.url,
      urlTemplate: placeholders.length > 0,
      pathParams,
      queryParams: placed('query'),
      bodyParams,
      auth:
        tool.auth === undefined
          ? undefined
          : tool.auth.type === 'bearer'
            ? { kind: 'bearer', header: 'Authorization', env: tool.auth.env }
            : { kind: 'header', header: tool.auth.name, env: tool.auth.env },
      maxResponseChars: tool.maxResponseChars ?? DEFAULT_MAX_RESPONSE_CHARS,
      sampleUrl: tool.url.replaceAll(/\{([^{}]*)\}/g, (_, name: string) => sampleOf(name)),
      sampleBodyJson: JSON.stringify(
        Object.fromEntries(
          bodyParams
            .filter((param) => param.required)
            .map((param) => [
              param.apiName ?? param.name,
              param.javaType === 'String' ? param.sampleText : (JSON.parse(param.sampleText) as unknown),
            ]),
        ),
      ),
    };
  }
  return {
    ...base,
    kind: 'java',
    handlerInterface: `${pascalCase(tool.name)}Handler`,
    handlerClass: `Default${pascalCase(tool.name)}Handler`,
  };
}

/**
 * What a valid agent.yaml asks for that this version cannot generate yet. The schema accepts the whole
 * specification; generation refuses these explicitly rather than ignoring them.
 */
export function unsupportedFeatures(file: AgentFile): string[] {
  const { agent } = file;
  const issues: string[] = [];
  const add = (condition: unknown, message: string): void => {
    if (condition !== undefined && condition !== false) issues.push(message);
  };

  add(agent.profile === 'production', 'agent.profile: "production" arrives in V5 (minimal and standard are generated)');
  add(agent.build === 'gradle', 'agent.build: Gradle arrives in a later version (V1 generates Maven)');
  add(
    agent.springAi !== SUPPORTED_SPRING_AI,
    `agent.springAi: ${agent.springAi} is not supported, this version of gen-agent generates Spring AI ${SUPPORTED_SPRING_AI}`,
  );
  add(agent.model.routing, 'agent.model.routing: model routing arrives in a later version');
  add(agent.model.fallback, 'agent.model.fallback: provider fallback arrives in a later version');
  add(agent.memory.type === 'redis', 'agent.memory.type: "redis" arrives in V5 (in-memory and jdbc are generated)');
  add(agent.memory.summarize, 'agent.memory.summarize: conversation summaries arrive in V5');
  add(agent.memory.retention, 'agent.memory.retention: retention and purge arrive in V4');
  agent.tools.forEach((tool, index) => {
    add(tool.approval, `agent.tools.${String(index)}.approval: human approval arrives in a later version`);
    if (tool.type === 'http') {
      add(tool.cacheTtl, `agent.tools.${String(index)}.cacheTtl: caching tool results arrives in a later version`);
    }
  });
  add(
    agent.openapi,
    'agent.openapi: the specs must be read first: gen-agent generate does it (the web generator imports a spec with "Import OpenAPI")',
  );
  add(agent.rag, 'agent.rag: RAG arrives in V5');
  add(agent.security?.piiMasking, 'agent.security.piiMasking: PII masking arrives in V5');
  add(
    agent.security?.injectionDetection,
    'agent.security.injectionDetection: prompt injection detection arrives in V5',
  );
  add(agent.cache?.semantic, 'agent.cache.semantic: the semantic cache arrives in V5');
  add(agent.limits, 'agent.limits: iteration and timeout limits arrive in a later version');
  add(
    agent.observability?.grafanaDashboard,
    'agent.observability.grafanaDashboard: the Grafana dashboard arrives in V5',
  );
  add(agent.observability?.feedback, 'agent.observability.feedback: feedback buttons arrive in a later version');
  add(
    agent.gdpr?.erasureEndpoint ?? agent.gdpr?.logsWithoutPii,
    'agent.gdpr: the erasure endpoint and PII-free logs arrive in V5',
  );
  add(agent.evals, 'agent.evals: evaluations and red teaming arrive in V5');
  add(
    agent.deploy?.includes('helm'),
    'agent.deploy: the Helm chart arrives in a later version (docker-compose is generated)',
  );
  return issues;
}
