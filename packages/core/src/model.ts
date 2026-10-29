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
import { SECRET_PATTERNS } from './rules.js';

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
  versions: { springBoot: string; springAi: string; bucket4j: string; resilience4j: string };
  /** Docker images of the services, pinned: the same in the tests and in Docker Compose. */
  images: typeof IMAGES;
  features: {
    httpTools: boolean;
    javaTools: boolean;
    /** Conversations kept in Postgres through Spring AI's JDBC repository. */
    jdbcMemory: boolean;
    /** Conversations kept in Redis lists. */
    redisMemory: boolean;
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
    /** Some MCP servers are remote, reached over Streamable HTTP. */
    remoteMcp: boolean;
    /** Some HTTP tools keep their results in Redis, per user, for their cacheTtl. */
    toolCache: boolean;
    /** Users rate answers up or down: counted, traced and kept in Postgres. */
    feedback: boolean;
    /** Tools report their calls, so that answers built from live data are not cached. */
    trackToolCalls: boolean;
    /** Every tool goes through ToolGuard: calls recorded, personal data restored in arguments and masked in results. */
    guardTools: boolean;
    /** A chat page served by the agent; with OIDC, users sign in from the browser. */
    chatUi: boolean;
    /** Personal data replaced by tokens before the model, restored in replies and tool arguments. */
    pii: boolean;
    /** Personal data masked in the logs, which carry a correlation id. */
    logsWithoutPii: boolean;
    /** DELETE /api/me and DELETE /api/users/{id}. */
    erasure: boolean;
    /** Conversations purged after `retention`. */
    retention: boolean;
    /** Answers reused for questions of the same meaning, per user. */
    semanticCache: boolean;
    /** pgvector: Postgres runs with the vector extension. */
    vectorStore: boolean;
    /** Postgres runs: for the conversations, the vector store or the tables of the agent. */
    postgres: boolean;
    /** Answers are grounded in the documents of a shared knowledge base. */
    rag: boolean;
    /** User messages and tool results checked for prompt injection; tool results marked as untrusted data. */
    injectionDetection: boolean;
    /** Answers checked before they leave: system prompt leaks refused, secrets masked. */
    outputGuard: boolean;
    /** The whole request bounded by `loop.timeout`. */
    requestTimeout: boolean;
    /** Tuned retries, a circuit breaker per model, the fallback model, then a fallback answer. */
    resilience: boolean;
    /** Simple messages go to a smaller model. */
    routing: boolean;
    /** Messages beyond the window are summarized instead of forgotten. */
    summarize: boolean;
    /** Some tool calls wait in Postgres for the approval of the user who asked. */
    approval: boolean;
    /** The agent and each tool can be switched off at once, flags in Redis. */
    killSwitches: boolean;
    /** Tokens carry roles: the agent-admin role erases any user or sets the kill switches. */
    adminRole: boolean;
    /** ./mvnw verify -Pevals scores the answers of a reference set on Ollama. */
    evals: boolean;
    /** The same run attacks the agent and checks it neither leaks its instructions nor obeys. */
    redTeam: boolean;
    /** A dashboard of the agent, provisioned into Grafana by Compose. */
    grafanaDashboard: boolean;
    /** A Helm chart to deploy the agent on Kubernetes. */
    helm: boolean;
  };
  /** The reference set, the red team, and the Ollama model they run on. */
  evals: { dataset: string | undefined; redTeam: boolean; model: string } | undefined;
  /** Tools whose calls wait for approval, by their name for the model, with their Spring duration. */
  approvalTools: { name: string; expiresAfter: string }[];
  /** HTTP tools whose results are cached, by their name for the model, with their Spring duration. */
  cachedTools: { name: string; ttl: string }[];
  /** Names of the generated tools for the model: what an administrator switches off. */
  toolNames: string[];
  /** The model used when the first one fails; another provider is built by hand, beside Spring AI's own. */
  fallback:
    | { provider: Provider; model: string; sameProvider: boolean; module: string; apiKeyEnv: string | undefined }
    | undefined;
  routing: { strategy: 'rules' | 'classifier'; simple: string; complex: string } | undefined;
  /** Models to pull into Ollama before the first run: chat models, embedding model, fallback model. */
  ollamaModels: string[];
  /** Bounds of one request: tool calls and duration (Spring duration). */
  loop: { maxIterations: number | undefined; timeout: string | undefined };
  /** Methods of the tools that only read data: still callable once a tool result held instructions. */
  readOnlyTools: string[];
  /** Java regular expressions of well-known API keys, masked in answers. */
  secretPatterns: string[];
  /** Spring duration after which unused conversations are purged. */
  retention: string | undefined;
  semanticCache: { threshold: number } | undefined;
  /** Passages per answer, whether the model reranks them, and their size in tokens. */
  rag: { topK: number; rerank: boolean; chunkSize: number } | undefined;
  /** Embedding model of the provider, for the semantic cache and RAG. */
  embedding: { model: string; dimensions: number } | undefined;
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
  /** The model module, without Spring Boot auto-configuration: for a fallback built by hand. */
  module: string;
  /** Who retries failed calls: the provider's SDK (`max-retries`) or Spring AI (`spring.ai.retry`). */
  retries: 'sdk' | 'spring';
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

function ollamaModelsOf(agent: AgentDefinition, semanticCache: boolean): string[] {
  const { model } = agent;
  return [
    ...new Set([
      ...(model.provider === 'ollama'
        ? [model.name, ...(model.routing ? [model.routing.simple, model.routing.complex] : [])]
        : []),
      ...(model.provider === 'ollama' && semanticCache && EMBEDDINGS.ollama ? [EMBEDDINGS.ollama.model] : []),
      ...(model.fallback?.provider === 'ollama' ? [model.fallback.name] : []),
    ]),
  ];
}

function fallbackOf(fallback: { provider: Provider; name: string }, provider: Provider): GenerationModel['fallback'] {
  const sameProvider = fallback.provider === provider;
  return {
    provider: fallback.provider,
    model: fallback.name,
    sameProvider,
    module: PROVIDERS[fallback.provider].module,
    apiKeyEnv: sameProvider ? undefined : PROVIDERS[fallback.provider].apiKeyEnv,
  };
}

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

type McpServer =
  | {
      kind: 'local';
      name: string;
      command: string;
      args: string[];
      /** Names of the environment variables passed to the server. */
      env: string[];
      /** Runs in a throwaway container: it sees only the variables it names, not the files of the agent. */
      sandboxed: boolean;
      /** The image of a sandboxed server, its package installed at build time so that it can run offline. */
      image?: {
        tag: string;
        base: string;
        runtime: 'node' | 'python';
        package: string;
        version: string;
        network: boolean;
      };
    }
  | {
      kind: 'remote';
      name: string;
      /** Scheme, host and port: Spring AI takes the path apart. */
      url: string;
      endpoint: string;
      auth: HttpAuth | undefined;
      /** Java name of its token in the generated configuration. */
      tokenField: string;
    };

/** Not managed by Spring Boot: checked on Maven Central (2026-10-24). */
const BUCKET4J_VERSION = '8.21.0';
const RESILIENCE4J_VERSION = '2.4.0';
/** How long a call waits for approval when agent.yaml does not say: a working day and a night. */
const DEFAULT_APPROVAL_EXPIRY = '24h';
/** Few, short passages: precise answers and few tokens. */
const RAG_DEFAULTS = { topK: 4, chunkSize: 500 };
// qwen2.5:1.5b judges at random; qwen2.5:3b is the smallest that judges reliably.
const DEFAULT_EVALS_MODEL = 'qwen2.5:3b';

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
  pgvector: 'pgvector/pgvector:0.8.7-pg18',
} as const;

/** Embedding model and its dimensions per provider; Anthropic has none. */
const EMBEDDINGS: Partial<Record<Provider, { model: string; dimensions: number }>> = {
  openai: { model: 'text-embedding-3-small', dimensions: 1536 },
  mistral: { model: 'mistral-embed', dimensions: 1024 },
  ollama: { model: 'nomic-embed-text', dimensions: 768 },
};

/** No capability, no privilege escalation, a read-only file system but /tmp, bounded memory, CPU and processes. */
const HARDENED_CONTAINER = [
  '--read-only',
  '--tmpfs',
  '/tmp:rw,exec,size=256m',
  '--cap-drop',
  'ALL',
  '--security-opt',
  'no-new-privileges',
  '--memory',
  '512m',
  '--cpus',
  '1',
  '--pids-limit',
  '256',
];

function mcpServerOf(server: NonNullable<AgentDefinition['mcp']>[number], agentName: string): McpServer {
  if (server.url !== undefined) {
    const url = new URL(server.url);
    return {
      kind: 'remote',
      name: server.name,
      url: url.origin,
      endpoint: url.pathname + url.search,
      tokenField: `${camelCase(server.name)}Token`,
      auth:
        server.auth === undefined
          ? undefined
          : server.auth.type === 'bearer'
            ? { kind: 'bearer', header: 'Authorization', env: server.auth.env }
            : { kind: 'header', header: server.auth.name, env: server.auth.env },
    };
  }
  const env = server.env ?? [];
  // Rules ensure a started server has its package, version and runtime.
  const runtime = server.runtime ?? 'node';
  const pkg = server.package ?? '';
  const version = server.version ?? '';
  if (server.sandbox === 'none') {
    return runtime === 'node'
      ? {
          kind: 'local',
          name: server.name,
          command: 'npx',
          args: ['--yes', `${pkg}@${version}`, ...(server.args ?? [])],
          env,
          sandboxed: false,
        }
      : {
          kind: 'local',
          name: server.name,
          command: 'uvx',
          args: [`${pkg}==${version}`, ...(server.args ?? [])],
          env,
          sandboxed: false,
        };
  }
  const tag = `${agentName}-mcp-${server.name}:${version}`;
  return {
    kind: 'local',
    name: server.name,
    command: 'docker',
    args: [
      'run',
      '--interactive',
      '--rm',
      '--network',
      server.network === true ? 'bridge' : 'none',
      ...HARDENED_CONTAINER,
      ...env.flatMap((name) => ['--env', name]),
      // npm writes its cache and logs: only /tmp is writable.
      ...(runtime === 'node'
        ? ['--env', 'HOME=/tmp', '--env', 'npm_config_cache=/tmp/npm', '--workdir', '/server']
        : []),
      tag,
      ...(runtime === 'node' ? ['npm', 'exec', '--offline', '--yes', '--', `${pkg}@${version}`] : ['/home/mcp/start']),
      ...(server.args ?? []),
    ],
    env,
    sandboxed: true,
    image: {
      tag,
      base: runtime === 'node' ? IMAGES.node : IMAGES.uv,
      runtime,
      package: pkg,
      version,
      network: server.network === true,
    },
  };
}

/** Large enough for a typical JSON answer, small enough to leave room in the model's context. */
export const DEFAULT_MAX_RESPONSE_CHARS = 20_000;

/** Spring AI starter and configuration keys per provider (non-deprecated keys of Spring AI 2.0.1). */
const PROVIDERS: Record<Provider, Omit<ProviderSettings, 'id' | 'model' | 'temperature' | 'maxTokens'>> = {
  openai: {
    starter: 'spring-ai-starter-model-openai',
    module: 'spring-ai-openai',
    retries: 'sdk',
    propertyPrefix: 'spring.ai.openai',
    configKey: 'openai',
    apiKeyEnv: 'OPENAI_API_KEY',
    maxTokensProperty: 'max-tokens',
  },
  anthropic: {
    starter: 'spring-ai-starter-model-anthropic',
    module: 'spring-ai-anthropic',
    retries: 'sdk',
    propertyPrefix: 'spring.ai.anthropic',
    configKey: 'anthropic',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    maxTokensProperty: 'max-tokens',
  },
  mistral: {
    starter: 'spring-ai-starter-model-mistral-ai',
    module: 'spring-ai-mistral-ai',
    retries: 'spring',
    propertyPrefix: 'spring.ai.mistralai',
    configKey: 'mistralai',
    apiKeyEnv: 'MISTRAL_API_KEY',
    maxTokensProperty: 'max-tokens',
  },
  ollama: {
    starter: 'spring-ai-starter-model-ollama',
    module: 'spring-ai-ollama',
    retries: 'spring',
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
  const semantic = agent.cache?.semantic;
  // The tokens of a conversation and the values they stand for are kept in Redis.
  const pii = agent.security?.piiMasking === true;
  const mcpServers = (agent.mcp ?? []).map((server) => mcpServerOf(server, agent.name));
  const hasTools = agent.tools.length > 0 || mcpServers.length > 0;
  const injectionDetection = agent.security?.injectionDetection === true;
  const killSwitches = agent.security?.killSwitches === true;
  const cachedTools = agent.tools.flatMap((tool, index) =>
    tool.type === 'http' && tool.cacheTtl !== undefined
      ? [{ name: tools[index]?.methodName ?? '', ttl: tool.cacheTtl }]
      : [],
  );
  const ragEnabled = agent.rag?.enabled === true;
  // The semantic cache and RAG both embed text with the model of the provider.
  const embeddings = semantic !== undefined || ragEnabled;
  const approvalTools = agent.tools.flatMap((tool, index) =>
    tool.approval?.required === true
      ? [{ name: tools[index]?.methodName ?? '', expiresAfter: tool.approval.expiresAfter ?? DEFAULT_APPROVAL_EXPIRY }]
      : [],
  );
  const fallback = agent.model.fallback;
  const fallbackKey =
    fallback === undefined || fallback.provider === agent.model.provider
      ? undefined
      : PROVIDERS[fallback.provider].apiKeyEnv;

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
    versions: {
      springBoot: SUPPORTED_SPRING_BOOT,
      springAi: agent.springAi,
      bucket4j: BUCKET4J_VERSION,
      resilience4j: RESILIENCE4J_VERSION,
    },
    images: IMAGES,
    features: {
      httpTools: agent.tools.some((tool) => tool.type === 'http'),
      javaTools: agent.tools.some((tool) => tool.type === 'java'),
      jdbcMemory: agent.memory.type === 'jdbc',
      redisMemory: agent.memory.type === 'redis',
      oidc,
      limits: requests !== undefined || tokens !== undefined,
      dockerCompose: agent.deploy?.includes('docker-compose') ?? false,
      cache,
      redis:
        requests !== undefined ||
        tokens !== undefined ||
        cache ||
        pii ||
        killSwitches ||
        agent.memory.type === 'redis' ||
        cachedTools.length > 0,
      otel: agent.observability?.otel === true,
      prometheus: agent.observability?.metrics === 'prometheus',
      mcp: mcpServers.length > 0,
      remoteMcp: mcpServers.some((server) => server.kind === 'remote'),
      toolCache: cachedTools.length > 0,
      feedback: agent.observability?.feedback === true,
      trackToolCalls: cache && hasTools,
      guardTools:
        (cache || pii || injectionDetection || killSwitches || approvalTools.length > 0 || cachedTools.length > 0) &&
        hasTools,
      chatUi: agent.interface.includes('chat-ui'),
      pii,
      logsWithoutPii: agent.gdpr?.logsWithoutPii === true,
      erasure: agent.gdpr?.erasureEndpoint === true,
      retention: agent.memory.retention !== undefined,
      semanticCache: semantic !== undefined,
      vectorStore: embeddings,
      postgres:
        agent.memory.type === 'jdbc' ||
        agent.observability?.feedback === true ||
        embeddings ||
        agent.gdpr?.erasureEndpoint === true ||
        agent.memory.retention !== undefined ||
        approvalTools.length > 0,
      rag: ragEnabled,
      injectionDetection,
      outputGuard: agent.security?.outputGuard === true,
      requestTimeout: agent.limits?.timeout !== undefined,
      resilience: agent.profile === 'production' || agent.model.fallback !== undefined,
      routing: agent.model.routing !== undefined,
      summarize: agent.memory.summarize === true,
      approval: approvalTools.length > 0,
      killSwitches,
      // Administrators also manage the documents, when users sign in.
      adminRole: agent.gdpr?.erasureEndpoint === true || killSwitches || (ragEnabled && oidc),
      evals: agent.evals !== undefined,
      redTeam: agent.evals?.redTeam === true,
      grafanaDashboard: agent.observability?.grafanaDashboard === true,
      helm: agent.deploy?.includes('helm') ?? false,
    },
    evals:
      agent.evals === undefined
        ? undefined
        : {
            dataset: agent.evals.dataset,
            redTeam: agent.evals.redTeam === true,
            // The model of the agent when it runs on Ollama; else a small one, quick to pull in CI.
            model: agent.model.provider === 'ollama' ? agent.model.name : DEFAULT_EVALS_MODEL,
          },
    approvalTools,
    cachedTools,
    toolNames: tools.map((tool) => tool.methodName),
    fallback: fallback === undefined ? undefined : fallbackOf(fallback, agent.model.provider),
    routing: agent.model.routing,
    ollamaModels: ollamaModelsOf(agent, embeddings),
    rag: ragEnabled
      ? {
          topK: agent.rag?.topK ?? RAG_DEFAULTS.topK,
          rerank: agent.rag?.rerank === true,
          chunkSize: agent.rag?.chunkSize ?? RAG_DEFAULTS.chunkSize,
        }
      : undefined,
    loop: { maxIterations: agent.limits?.maxIterations, timeout: agent.limits?.timeout },
    readOnlyTools: tools.flatMap((tool) => (tool.kind === 'http' && tool.method === 'GET' ? [tool.methodName] : [])),
    secretPatterns: SECRET_PATTERNS.map((pattern) => pattern.source),
    retention: agent.memory.retention,
    semanticCache: semantic === undefined ? undefined : { threshold: semantic.threshold },
    embedding: embeddings ? EMBEDDINGS[agent.model.provider] : undefined,
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
        ...(fallbackKey === undefined ? [] : [fallbackKey]),
        ...tools.flatMap((tool) => (tool.kind === 'http' && tool.auth !== undefined ? [tool.auth.env] : [])),
        ...mcpServers.flatMap((server) =>
          server.kind === 'local' ? server.env : server.auth === undefined ? [] : [server.auth.env],
        ),
      ]),
    ],
    testProperties: [
      ...(providerSettings.apiKeyEnv === undefined ? [] : [`${providerSettings.propertyPrefix}.api-key=test-key`]),
      ...(oidc ? ['spring.security.oauth2.resourceserver.jwt.issuer-uri=https://issuer.example.org'] : []),
      ...(mcpServers.length > 0 ? ['spring.ai.mcp.client.enabled=false'] : []),
      ...mcpServers.flatMap((server) =>
        server.kind === 'remote' && server.auth !== undefined ? [`agent.mcp.${server.name}.token=test-token`] : [],
      ),
      ...(fallbackKey === undefined ? [] : ['agent.fallback.api-key=test-key']),
      ...(ragEnabled ? ['agent.rag.documents=src/test/resources/documents'] : []),
      // A short timeout, so that the test of a request that takes too long runs quickly.
      ...(agent.limits?.timeout === undefined ? [] : ['agent.timeout=3s']),
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

  add(agent.build === 'gradle', 'agent.build: Gradle arrives in a later version (V1 generates Maven)');
  add(
    agent.springAi !== SUPPORTED_SPRING_AI,
    `agent.springAi: ${agent.springAi} is not supported, this version of gen-agent generates Spring AI ${SUPPORTED_SPRING_AI}`,
  );
  add(
    agent.openapi,
    'agent.openapi: the specs must be read first: gen-agent generate does it (the web generator imports a spec with "Import OpenAPI")',
  );
  return issues;
}
