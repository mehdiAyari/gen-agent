import type { GenerationModel } from './model.js';

/** A dependency of the generated project, for Maven and Gradle alike. */
export interface Dependency {
  group: string;
  artifact: string;
  /** Only for what the Spring Boot and Spring AI BOMs do not manage. */
  version?: string;
  scope: 'compile' | 'runtime' | 'test';
  /** Why it is there, when its name does not say. */
  comment?: string;
}

const boot = (artifact: string, scope: Dependency['scope'] = 'compile'): Dependency => ({
  group: 'org.springframework.boot',
  artifact,
  scope,
});
const ai = (artifact: string, scope: Dependency['scope'] = 'compile', comment?: string): Dependency => ({
  group: 'org.springframework.ai',
  artifact,
  scope,
  ...(comment === undefined ? {} : { comment }),
});

/** Every dependency of the project, in the order a person would list them: the agent, then its tests. */
export function dependenciesOf(model: Omit<GenerationModel, 'dependencies' | 'build'>): Dependency[] {
  const { features, provider, fallback, versions } = model;
  const when = (condition: boolean, ...dependencies: Dependency[]): Dependency[] => (condition ? dependencies : []);
  const flyway = features.erasure || features.retention || features.approval || features.rag || features.feedback;
  // The fallback provider's module, when it is Ollama, already brings what the evaluations run on.
  const evalsModel =
    features.evals && provider.id !== 'ollama' && !(fallback?.provider === 'ollama' && !fallback.sameProvider);
  return [
    boot('spring-boot-starter-webmvc'),
    boot('spring-boot-starter-validation'),
    ...when(features.httpTools, boot('spring-boot-starter-restclient')),
    ai(provider.starter),
    ...when(
      fallback !== undefined && !fallback.sameProvider,
      ai(
        fallback?.module ?? '',
        'compile',
        'The model of the fallback provider, without its auto-configuration: one ChatModel bean only.',
      ),
    ),
    ...when(features.resilience, {
      group: 'io.github.resilience4j',
      artifact: 'resilience4j-spring-boot4',
      version: versions.resilience4j,
      scope: 'compile',
    }),
    ...(features.jdbcMemory
      ? [ai('spring-ai-starter-model-chat-memory-repository-jdbc')]
      : when(features.postgres, boot('spring-boot-starter-jdbc'))),
    ...when(features.postgres, { group: 'org.postgresql', artifact: 'postgresql', scope: 'runtime' }),
    ...when(flyway, boot('spring-boot-starter-flyway'), {
      group: 'org.flywaydb',
      artifact: 'flyway-database-postgresql',
      scope: 'compile',
    }),
    ...when(features.vectorStore, ai('spring-ai-pgvector-store')),
    ...when(
      features.rag,
      ai(
        'spring-ai-tika-document-reader',
        'compile',
        'Reads the documents of the knowledge base: PDF, Word, PowerPoint, HTML, Markdown, text…',
      ),
    ),
    ...when(features.oidc, boot('spring-boot-starter-oauth2-resource-server')),
    ...when(features.redis, boot('spring-boot-starter-data-redis')),
    ...when(features.limits, {
      group: 'com.bucket4j',
      artifact: 'bucket4j_jdk17-lettuce',
      version: versions.bucket4j,
      scope: 'compile',
    }),
    ...when(features.mcp, ai('spring-ai-starter-mcp-client')),
    ...when(features.otel || features.prometheus, boot('spring-boot-starter-actuator')),
    ...when(features.otel, boot('spring-boot-starter-opentelemetry')),
    ...when(features.prometheus, {
      group: 'io.micrometer',
      artifact: 'micrometer-registry-prometheus',
      scope: 'runtime',
    }),
    boot('spring-boot-starter-webmvc-test', 'test'),
    ...when(features.httpTools, boot('spring-boot-starter-restclient-test', 'test')),
    ...when(features.oidc, boot('spring-boot-starter-security-test', 'test')),
    ...when(evalsModel, ai('spring-ai-ollama', 'test', 'The model of the evaluations.')),
    ...when(features.postgres || features.redis, boot('spring-boot-testcontainers', 'test')),
    ...when(features.postgres, { group: 'org.testcontainers', artifact: 'testcontainers-postgresql', scope: 'test' }),
    ...when(features.redis, { group: 'com.redis', artifact: 'testcontainers-redis', scope: 'test' }),
  ];
}
