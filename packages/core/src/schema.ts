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
      type: z.enum(['in-memory', 'jdbc', 'redis']).default('in-memory'),
      window: z.int().positive().default(20),
      summarize: z.boolean().optional(),
      retention: duration.optional(),
    })
    .default({ type: 'in-memory', window: 20 }),
  tools: z.array(tool).default([]),
  openapi: z
    .array(
      z.strictObject({
        /** Path of the spec file, relative to agent.yaml. */
        spec: z.string().min(1),
        include: z.array(z.string().min(1)).optional(),
        /** Base URL of the API, when the spec gives a relative server URL. */
        baseUrl: z.url({ protocol: /^https?$/ }).optional(),
      }),
    )
    .optional(),
  mcp: z
    .array(
      z.strictObject({
        name: kebabCase,
        package: z.string().min(1),
        version: exactVersion,
        runtime: z.enum(['node', 'python']),
        sandbox: z.enum(['docker', 'none']).default('docker'),
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

/** Schema of an `agent.yaml` file. Cross-field rules live in `rules.ts`. */
export const agentFileSchema = z.strictObject({ agent });

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
