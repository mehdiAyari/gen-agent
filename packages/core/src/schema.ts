import { z } from 'zod';

/** Spring AI version the templates are pinned to (latest stable on Maven Central, checked 2026-10-22). */
export const SUPPORTED_SPRING_AI = '2.0.1';

export const PROVIDERS = ['openai', 'anthropic', 'mistral', 'ollama'] as const;
/** Providers acceptable when `gdpr.euOnly` is set: hosted in the EU, or self-hosted. */
export const EU_PROVIDERS: readonly Provider[] = ['mistral', 'ollama'];
export type Provider = (typeof PROVIDERS)[number];

const kebabCase = z
  .string()
  .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, 'must be kebab-case: lowercase letters, digits and single dashes');

const javaPackage = z
  .string()
  .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/, 'must be a valid Java package, e.g. com.example.assistant');

/** Exact semantic version: `latest` and ranges are refused. */
const exactVersion = z.string().regex(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/, 'must be an exact version, e.g. 1.0.0');

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
  name: z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'must be a camelCase identifier'),
  type: z.enum(['string', 'number', 'integer', 'boolean']),
  required: z.boolean().default(false),
  description: z.string().min(1).optional(),
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

const httpTool = z.strictObject({
  ...toolBase,
  type: z.literal('http'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  url: z.url({ protocol: /^https?$/ }),
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
      system: z.string().min(1).default('prompts/system.md'),
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
    .array(z.strictObject({ spec: z.string().min(1), include: z.array(z.string().min(1)).optional() }))
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
