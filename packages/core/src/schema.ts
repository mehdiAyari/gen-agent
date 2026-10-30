import { z } from 'zod';

/** Version of gen-agent recorded in .gen-agent.json, by the CLI and the web UI alike (kept equal to the CLI package version). */
export const GENERATOR_VERSION = '0.1.0';

/** Spring AI version the templates are pinned to (latest stable on Maven Central, checked 2026-10-22). */
export const SUPPORTED_SPRING_AI = '2.0.1';
/** Spring Boot version Spring AI 2.0.1 is built against. */
export const SUPPORTED_SPRING_BOOT = '4.1.1';

export const PROVIDERS = ['openai', 'anthropic', 'mistral', 'ollama'] as const;
/** Providers acceptable when `gdpr.euOnly` is set: hosted in the EU, or self-hosted. */
export const EU_PROVIDERS: readonly Provider[] = ['mistral', 'ollama'];
export type Provider = (typeof PROVIDERS)[number];

/** Model suggested when a provider is picked (CLI and web UI); any model name the provider accepts can be used instead. */
export const SUGGESTED_MODELS: Record<Provider, string> = {
  openai: 'gpt-5-mini',
  anthropic: 'claude-sonnet-5',
  mistral: 'mistral-small-latest',
  ollama: 'llama3.1',
};

const kebabCase = z
  .string()
  .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, 'must be kebab-case: lowercase letters, digits and single dashes');

const javaPackage = z
  .string()
  .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/, 'must be a valid Java package, e.g. com.example.assistant');

/** Exact semantic version: `latest` and ranges are refused. */
const exactVersion = z.string().regex(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/, 'must be an exact version, e.g. 1.0.0');

/** Java keywords and literals: a tool parameter becomes a Java parameter name. */
export const JAVA_RESERVED: ReadonlySet<string> = new Set(
  (
    'abstract assert boolean break byte case catch char class const continue default do double else enum extends ' +
    'final finally float for goto if implements import instanceof int interface long native new package private ' +
    'protected public return short static strictfp super switch synchronized this throw throws transient try void ' +
    'volatile while true false null var yield record'
  ).split(' '),
);

/** A path relative to src/main/resources, that cannot escape the project. */
const resourcePath = z
  .string()
  .min(1)
  .refine(
    (path) => !path.startsWith('/') && !path.split('/').includes('..'),
    'must be a relative path inside the project, without ".."',
  );

const duration = z.string().regex(/^\d+[smhd]$/, 'must be a duration such as 60s, 10m, 24h or 30d');
const rate = z.string().regex(/^\d+\/(sec|min|hour|day)$/, 'must be a rate such as 30/min or 50000/day');

const provider = z.enum(PROVIDERS);

const model = z.strictObject({
  provider,
  name: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.int().positive().optional(),
  routing: z
    .strictObject({
      strategy: z.enum(['rules', 'classifier'], 'is required when routing is set: rules or classifier'),
      simple: z.string().min(1),
      complex: z.string().min(1),
    })
    .optional(),
  fallback: z.strictObject({ provider, name: z.string().min(1) }).optional(),
});

const toolParam = z.strictObject({
  name: z
    .string()
    .regex(/^[a-z][a-zA-Z0-9]*$/, 'must be a camelCase identifier')
    .refine((name) => !JAVA_RESERVED.has(name), 'is a reserved word in Java, choose another name'),
  type: z.enum(['string', 'number', 'integer', 'boolean']),
  required: z.boolean().default(false),
  description: z.string().min(1).optional(),
  /** HTTP tools only: where the value goes. Defaults in {@link placementOf}. */
  in: z.enum(['path', 'query', 'body']).optional(),
  /** HTTP tools only: the name in the query or the JSON body, when it is not a Java name (employee_id). */
  apiName: z
    .string()
    .regex(/^[A-Za-z0-9_.$-]+$/, 'must be a query or JSON property name')
    .optional(),
});

const approval = z.strictObject({
  required: z.boolean(),
  expiresAfter: duration.optional(),
});

const toolBase = {
  name: kebabCase,
  description: z.string().min(1).optional(),
  params: z.array(toolParam).default([]),
  approval: approval.optional(),
};

/** `{name}` placeholders of a URL template, in order. */
export function urlPlaceholders(url: string): string[] {
  return [...url.matchAll(/\{([^{}]*)\}/g)].map((match) => match[1] ?? '');
}

/** An http(s) URL, possibly with `{name}` placeholders for path parameters. */
const urlTemplate = z.string().refine((url) => {
  if (urlPlaceholders(url).some((name) => !/^[a-z][a-zA-Z0-9]*$/.test(name))) return false;
  try {
    return /^https?:$/.test(new URL(url.replaceAll(/\{[^{}]*\}/g, 'x')).protocol);
  } catch {
    return false;
  }
}, 'must be an http(s) URL; path parameters are written {camelCaseName}');

const environmentVariable = z
  .string()
  .regex(/^[A-Z][A-Z0-9_]*$/, 'must be an environment variable name in upper case, e.g. SHOP_API_TOKEN');

/** The secret itself never appears in agent.yaml: only the environment variable that holds it. */
const auth = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('bearer'), env: environmentVariable }),
  z.strictObject({
    type: z.literal('header'),
    name: z.string().regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/, 'must be an HTTP header name, e.g. X-API-Key'),
    env: environmentVariable,
  }),
]);

const httpTool = z.strictObject({
  ...toolBase,
  type: z.literal('http'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  url: urlTemplate,
  auth: auth.optional(),
  /** Longer responses are cut before reaching the model, which has a limited context. */
  maxResponseChars: z.int().positive().optional(),
  cacheTtl: duration.optional(),
});

const javaTool = z.strictObject({
  ...toolBase,
  type: z.literal('java'),
});

const tool = z.discriminatedUnion('type', [httpTool, javaTool]);

const agent = z.strictObject({
  name: kebabCase,
  description: z.string().min(1).optional(),
  package: javaPackage.optional(),
  profile: z.enum(['minimal', 'standard', 'production']).default('minimal'),
  java: z.literal(21).default(21),
  build: z.enum(['maven', 'gradle']).default('maven'),
  springAi: exactVersion.default(SUPPORTED_SPRING_AI),
  model,
  prompt: z
    .strictObject({
      system: resourcePath.default('prompts/system.md'),
      aiDisclosure: z.boolean().default(true),
    })
    .default({ system: 'prompts/system.md', aiDisclosure: true }),
  memory: z
    .strictObject({
      /** Default from the profile: in-memory for minimal, jdbc otherwise. */
      type: z.enum(['in-memory', 'jdbc', 'redis']).optional(),
      window: z.int().positive().default(20),
      summarize: z.boolean().optional(),
      retention: duration.optional(),
    })
    .default({ window: 20 }),
  tools: z.array(tool).default([]),
  openapi: z
    .array(
      z.strictObject({
        /** Path of the spec file, relative to agent.yaml. */
        spec: z.string().min(1),
        include: z.array(z.string().min(1)).optional(),
        /** Base URL of the API, when the spec gives a relative server URL. */
        baseUrl: z.url({ protocol: /^https?$/ }).optional(),
        /** `none`: the API is public, whatever security its spec declares. */
        auth: z.literal('none').optional(),
      }),
    )
    .optional(),
  mcp: z
    .array(
      // A server the agent starts (package, version, runtime) or a remote one (url): rules.ts checks which.
      z.strictObject({
        name: kebabCase,
        package: z.string().min(1).optional(),
        version: exactVersion.optional(),
        runtime: z.enum(['node', 'python']).optional(),
        /** Started servers only; docker by default. */
        sandbox: z.enum(['docker', 'none']).optional(),
        /** Arguments of the server, after its package: a directory to serve, an option… */
        args: z.array(z.string().min(1)).optional(),
        /** Environment variables the server needs, by name only: their values never appear in agent.yaml. */
        env: z.array(environmentVariable).optional(),
        /** A server in a container is cut off the network unless this is true. */
        network: z.boolean().optional(),
        /** A remote server, over Streamable HTTP. */
        url: z.url().optional(),
        /** The token of a remote server, from an environment variable. */
        auth: auth.optional(),
      }),
    )
    .optional(),
  rag: z
    .strictObject({
      enabled: z.boolean(),
      vectorStore: z.enum(['pgvector']).optional(),
      topK: z.int().positive().optional(),
      rerank: z.boolean().optional(),
      chunkSize: z.int().positive().optional(),
    })
    .optional(),
  security: z
    .strictObject({
      auth: z.enum(['none', 'oidc']).optional(),
      rateLimit: rate.optional(),
      tokenBudget: rate.optional(),
      piiMasking: z.boolean().optional(),
      injectionDetection: z.boolean().optional(),
      /** Answers checked before they leave: system prompt leaks refused, secrets masked. */
      outputGuard: z.boolean().optional(),
      /** The agent and each tool can be switched off at once by an administrator. */
      killSwitches: z.boolean().optional(),
    })
    .optional(),
  cache: z
    .strictObject({
      exact: z.enum(['none', 'redis']).optional(),
      semantic: z
        .strictObject({
          threshold: z.number().min(0).max(1),
          scope: z.enum(['user', 'global']).default('user'),
        })
        .optional(),
    })
    .optional(),
  limits: z
    .strictObject({
      maxIterations: z.int().positive().optional(),
      timeout: duration.optional(),
    })
    .optional(),
  observability: z
    .strictObject({
      otel: z.boolean().optional(),
      metrics: z.enum(['none', 'prometheus']).optional(),
      grafanaDashboard: z.boolean().optional(),
      feedback: z.boolean().optional(),
    })
    .optional(),
  gdpr: z
    .strictObject({
      euOnly: z.boolean().optional(),
      allowNonEuProviders: z.boolean().optional(),
      erasureEndpoint: z.boolean().optional(),
      logsWithoutPii: z.boolean().optional(),
    })
    .optional(),
  evals: z
    .strictObject({
      dataset: z.string().min(1).optional(),
      redTeam: z.boolean().optional(),
      ciModel: z.enum(['ollama']).optional(),
    })
    .optional(),
  interface: z.array(z.enum(['rest', 'chat-ui'])).default(['rest']),
  deploy: z.array(z.enum(['docker-compose', 'helm'])).optional(),
});

/** Limits of the standard profile when agent.yaml sets none: enough for a person, not for a script. */
export const STANDARD_LIMITS = { rateLimit: '30/min', tokenBudget: '100000/day' } as const;

/** Defaults of the production profile: conversations kept 30 days, a semantic cache per user, bounded requests, evaluations. */
export const PRODUCTION_DEFAULTS = {
  retention: '30d',
  semanticThreshold: 0.95,
  maxIterations: 8,
  timeout: '60s',
  dataset: 'evals/golden.yaml',
} as const;

/** How long a production request may take: a local model on a laptop CPU takes minutes, a hosted one seconds. */
export function productionTimeout(provider: Provider): string {
  return provider === 'ollama' ? '5m' : PRODUCTION_DEFAULTS.timeout;
}

/** Providers with an embedding model, which the semantic cache needs. */
export const EMBEDDING_PROVIDERS: readonly Provider[] = ['openai', 'mistral', 'ollama'];

/**
 * What the profile equips the agent with, unless agent.yaml says otherwise: minimal adds nothing; standard and
 * production add a JDBC memory, OIDC with request and token limits per user, and Docker Compose.
 */
const equipped = agent.transform((definition) => {
  const full = definition.profile !== 'minimal';
  const memory = { ...definition.memory, type: definition.memory.type ?? (full ? 'jdbc' : 'in-memory') };
  if (!full) return { ...definition, memory };

  const auth = definition.security?.auth ?? 'oidc';
  // Limits are counted per user: without sign-in, none is added.
  const limits =
    auth === 'oidc'
      ? {
          rateLimit: definition.security?.rateLimit ?? STANDARD_LIMITS.rateLimit,
          tokenBudget: definition.security?.tokenBudget ?? STANDARD_LIMITS.tokenBudget,
        }
      : {};
  const production = definition.profile === 'production';
  const signedIn = auth === 'oidc';
  const semantic =
    production && signedIn && EMBEDDING_PROVIDERS.includes(definition.model.provider)
      ? { semantic: { threshold: PRODUCTION_DEFAULTS.semanticThreshold, scope: 'user' as const } }
      : {};
  return {
    ...definition,
    // Only conversations kept in Postgres are purged.
    memory: production && memory.type === 'jdbc' ? { retention: PRODUCTION_DEFAULTS.retention, ...memory } : memory,
    security: {
      ...(production
        ? { piiMasking: true, injectionDetection: true, outputGuard: true, ...(signedIn ? { killSwitches: true } : {}) }
        : {}),
      ...definition.security,
      auth,
      ...limits,
    },
    ...(production
      ? {
          limits: {
            maxIterations: PRODUCTION_DEFAULTS.maxIterations,
            timeout: productionTimeout(definition.model.provider),
            ...definition.limits,
          },
        }
      : {}),
    // Answers are cached per user: only when users sign in.
    ...(definition.cache === undefined && signedIn ? { cache: { exact: 'redis' as const, ...semantic } } : {}),
    ...(production
      ? {
          gdpr: {
            // Conversations are found per user in Postgres.
            ...(signedIn && memory.type === 'jdbc' ? { erasureEndpoint: true } : {}),
            logsWithoutPii: true,
            ...definition.gdpr,
          },
        }
      : {}),
    observability: definition.observability ?? {
      otel: true,
      metrics: 'prometheus' as const,
      ...(production ? { grafanaDashboard: true, feedback: true } : {}),
    },
    deploy:
      definition.deploy ?? (production ? ['docker-compose' as const, 'helm' as const] : ['docker-compose' as const]),
    ...(production
      ? {
          evals: {
            dataset: PRODUCTION_DEFAULTS.dataset,
            redTeam: true,
            ciModel: 'ollama' as const,
            ...definition.evals,
          },
        }
      : {}),
  };
});

export const agentFileSchema = z.strictObject({ agent: equipped });

export type AgentFile = z.output<typeof agentFileSchema>;
export type AgentDefinition = AgentFile['agent'];
export type Tool = AgentDefinition['tools'][number];
export type ToolParamType = Tool['params'][number]['type'];
export type HttpTool = Extract<Tool, { type: 'http' }>;
export type ParamPlacement = 'path' | 'query' | 'body';

/** Methods that send no request body. */
export const BODYLESS_METHODS: ReadonlySet<string> = new Set(['GET', 'DELETE']);

/**
 * Where a parameter of an HTTP tool goes: where `in` says, else in the path when the URL has its placeholder, else in
 * the query for GET and DELETE and in the JSON body for the other methods.
 */
export function placementOf(tool: HttpTool, param: HttpTool['params'][number]): ParamPlacement {
  if (param.in !== undefined) return param.in;
  if (urlPlaceholders(tool.url).includes(param.name)) return 'path';
  return BODYLESS_METHODS.has(tool.method) ? 'query' : 'body';
}
