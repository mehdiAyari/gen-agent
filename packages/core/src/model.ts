import {
  SUPPORTED_SPRING_AI,
  type AgentDefinition,
  type AgentFile,
  type Provider,
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
    displayName: string;
  };
  springAi: string;
  provider: ProviderSettings;
  prompt: { resource: string; aiDisclosure: boolean };
  memory: { window: number };
  tools: ModelTool[];
}

export interface ProviderSettings {
  id: Provider;
  starter: string;
  propertyPrefix: string;
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
}

interface ModelToolBase {
  name: string;
  className: string;
  methodName: string;
  description: string | undefined;
  params: ToolParameter[];
}

export type ModelTool =
  | (ModelToolBase & { kind: 'http'; method: string; url: string })
  | (ModelToolBase & {
      kind: 'java';
      /** Generated interface the tool delegates to. */
      handlerInterface: string;
      /** User-owned implementation, created once and never rewritten. */
      handlerClass: string;
    });

/** Spring AI starter and configuration keys per provider (non-deprecated keys of Spring AI 2.0.1). */
const PROVIDERS: Record<Provider, Omit<ProviderSettings, 'id' | 'model' | 'temperature' | 'maxTokens'>> = {
  openai: {
    starter: 'spring-ai-starter-model-openai',
    propertyPrefix: 'spring.ai.openai',
    apiKeyEnv: 'OPENAI_API_KEY',
    maxTokensProperty: 'max-tokens',
  },
  anthropic: {
    starter: 'spring-ai-starter-model-anthropic',
    propertyPrefix: 'spring.ai.anthropic',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    maxTokensProperty: 'max-tokens',
  },
  mistral: {
    starter: 'spring-ai-starter-model-mistral-ai',
    propertyPrefix: 'spring.ai.mistralai',
    apiKeyEnv: 'MISTRAL_API_KEY',
    maxTokensProperty: 'max-tokens',
  },
  ollama: {
    starter: 'spring-ai-starter-model-ollama',
    propertyPrefix: 'spring.ai.ollama',
    apiKeyEnv: undefined,
    maxTokensProperty: 'num-predict',
  },
};

/** Required parameters use primitives; optional ones are boxed so the model can omit them (null). */
const JAVA_TYPES: Record<ToolParamType, { required: string; optional: string }> = {
  string: { required: 'String', optional: 'String' },
  number: { required: 'double', optional: 'Double' },
  integer: { required: 'long', optional: 'Long' },
  boolean: { required: 'boolean', optional: 'Boolean' },
};

const capitalizedWords = (kebab: string): string[] =>
  kebab.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1));

const pascalCase = (kebab: string): string => capitalizedWords(kebab).join('');

const camelCase = (kebab: string): string => {
  const pascal = pascalCase(kebab);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};

export function buildModel(file: AgentFile): GenerationModel {
  const { agent } = file;
  const basePackage = agent.package ?? `com.example.${agent.name.replaceAll('-', '')}`;
  const groupId = basePackage.includes('.') ? basePackage.slice(0, basePackage.lastIndexOf('.')) : basePackage;

  return {
    agent,
    project: {
      artifactId: agent.name,
      groupId,
      basePackage,
      basePackagePath: basePackage.replaceAll('.', '/'),
      generatedPackage: `${basePackage}.generated`,
      applicationClass: `${pascalCase(agent.name)}Application`,
      displayName: capitalizedWords(agent.name).join(' '),
    },
    springAi: agent.springAi,
    provider: {
      id: agent.model.provider,
      ...PROVIDERS[agent.model.provider],
      model: agent.model.name,
      temperature: agent.model.temperature,
      maxTokens: agent.model.maxTokens,
    },
    prompt: { resource: agent.prompt.system, aiDisclosure: agent.prompt.aiDisclosure },
    memory: { window: agent.memory.window },
    tools: agent.tools.map((tool): ModelTool => {
      const base: ModelToolBase = {
        name: tool.name,
        className: `${pascalCase(tool.name)}Tool`,
        methodName: camelCase(tool.name),
        description: tool.description,
        params: tool.params.map((param) => {
          const types = JAVA_TYPES[param.type];
          return {
            name: param.name,
            javaType: param.required ? types.required : types.optional,
            required: param.required,
            description: param.description,
          };
        }),
      };
      return tool.type === 'http'
        ? { ...base, kind: 'http', method: tool.method, url: tool.url }
        : {
            ...base,
            kind: 'java',
            handlerInterface: `${pascalCase(tool.name)}Handler`,
            handlerClass: `Default${pascalCase(tool.name)}Handler`,
          };
    }),
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

  if (agent.profile !== 'minimal') {
    const version = agent.profile === 'standard' ? 'V4' : 'V5';
    issues.push(`agent.profile: "${agent.profile}" arrives in ${version} (V1 generates the minimal profile)`);
  }
  add(agent.build === 'gradle', 'agent.build: Gradle arrives in a later version (V1 generates Maven)');
  add(
    agent.springAi !== SUPPORTED_SPRING_AI,
    `agent.springAi: ${agent.springAi} is not supported, this version of gen-agent generates Spring AI ${SUPPORTED_SPRING_AI}`,
  );
  add(agent.model.routing, 'agent.model.routing: model routing arrives in a later version');
  add(agent.model.fallback, 'agent.model.fallback: provider fallback arrives in a later version');
  if (agent.memory.type !== 'in-memory') {
    issues.push(`agent.memory.type: "${agent.memory.type}" arrives in ${agent.memory.type === 'jdbc' ? 'V4' : 'V5'}`);
  }
  add(agent.memory.summarize, 'agent.memory.summarize: conversation summaries arrive in V5');
  add(agent.memory.retention, 'agent.memory.retention: retention and purge arrive in V4');
  agent.tools.forEach((tool, index) => {
    add(tool.approval, `agent.tools.${String(index)}.approval: human approval arrives in a later version`);
    if (tool.type === 'http') add(tool.cacheTtl, `agent.tools.${String(index)}.cacheTtl: tool caching arrives in V4`);
  });
  add(agent.openapi, 'agent.openapi: OpenAPI import arrives in V3');
  add(agent.mcp, 'agent.mcp: MCP clients arrive in V4');
  add(agent.rag, 'agent.rag: RAG arrives in V5');
  add(agent.security, 'agent.security: authentication, rate limiting and guardrails arrive in V4 and V5');
  add(agent.cache, 'agent.cache: caching arrives in V4 (exact) and V5 (semantic)');
  add(agent.limits, 'agent.limits: iteration and timeout limits arrive in a later version');
  add(agent.observability, 'agent.observability: OpenTelemetry and metrics arrive in V4');
  add(
    agent.gdpr?.erasureEndpoint ?? agent.gdpr?.logsWithoutPii,
    'agent.gdpr: the erasure endpoint and PII-free logs arrive in V5',
  );
  add(agent.evals, 'agent.evals: evaluations and red teaming arrive in V5');
  add(
    agent.interface.includes('chat-ui'),
    'agent.interface: the chat UI arrives in V4 (V1 generates the REST endpoint)',
  );
  add(agent.deploy, 'agent.deploy: Docker Compose arrives in V4, Helm later');
  return issues;
}
