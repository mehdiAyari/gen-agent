import type { GenerationModel, TemplateEntry } from '@gen-agent/core';

const main = (m: GenerationModel, path: string): string => `src/main/java/${m.project.basePackagePath}/${path}`;
const test = (m: GenerationModel, path: string): string => `src/test/java/${m.project.basePackagePath}/${path}`;

/** Files of the `minimal` profile and their owners (docs/adr/0001-separate-generated-and-user-code.md). */
export const minimalEntries: TemplateEntry[] = [
  { template: 'pom.xml.ejs', owner: 'merged', output: () => 'pom.xml' },
  { template: 'gitignore.ejs', owner: 'merged', output: () => '.gitignore' },
  // Maven Wrapper 3.3.4 (Apache 2.0), copied as distributed; pins Maven 3.9.16 and checks its SHA-256.
  { template: 'maven-wrapper/mvnw', owner: 'generated', raw: true, executable: true, output: () => 'mvnw' },
  { template: 'maven-wrapper/mvnw.cmd', owner: 'generated', raw: true, output: () => 'mvnw.cmd' },
  {
    template: 'maven-wrapper/maven-wrapper.properties',
    owner: 'generated',
    raw: true,
    output: () => '.mvn/wrapper/maven-wrapper.properties',
  },
  { template: 'README.md.ejs', owner: 'merged', output: () => 'README.md' },
  { template: 'Dockerfile.ejs', owner: 'merged', when: (m) => m.features.dockerCompose, output: () => 'Dockerfile' },
  {
    template: 'dockerignore.ejs',
    owner: 'merged',
    when: (m) => m.features.dockerCompose,
    output: () => '.dockerignore',
  },
  {
    template: 'compose.yaml.ejs',
    owner: 'merged',
    when: (m) => m.features.dockerCompose,
    output: () => 'compose.yaml',
  },
  {
    template: 'docker/realm-agent.json.ejs',
    owner: 'merged',
    when: (m) => m.features.dockerCompose && m.features.oidc,
    output: () => 'docker/keycloak/realm-agent.json',
  },
  { template: 'application.yml.ejs', owner: 'merged', output: () => 'src/main/resources/application.yml' },
  { template: 'system-prompt.md.ejs', owner: 'user', output: (m) => `src/main/resources/${m.prompt.resource}` },

  {
    template: 'java/Application.java.ejs',
    owner: 'merged',
    output: (m) => main(m, `${m.project.applicationClass}.java`),
  },
  {
    template: 'java/generated/AgentProperties.java.ejs',
    owner: 'generated',
    output: (m) => main(m, 'generated/AgentProperties.java'),
  },
  {
    template: 'java/generated/AgentConfiguration.java.ejs',
    owner: 'generated',
    output: (m) => main(m, 'generated/AgentConfiguration.java'),
  },
  {
    template: 'java/generated/chat/ChatController.java.ejs',
    owner: 'generated',
    output: (m) => main(m, 'generated/chat/ChatController.java'),
  },
  {
    template: 'java/generated/chat/ChatService.java.ejs',
    owner: 'generated',
    output: (m) => main(m, 'generated/chat/ChatService.java'),
  },
  {
    template: 'java/generated/chat/ChatExceptionHandler.java.ejs',
    owner: 'generated',
    output: (m) => main(m, 'generated/chat/ChatExceptionHandler.java'),
  },
  {
    template: 'java/generated/chat/ChatMessageRequest.java.ejs',
    owner: 'generated',
    output: (m) => main(m, 'generated/chat/ChatMessageRequest.java'),
  },
  {
    template: 'java/generated/chat/ChatMessageResponse.java.ejs',
    owner: 'generated',
    output: (m) => main(m, 'generated/chat/ChatMessageResponse.java'),
  },

  {
    template: 'java/generated/chat/UnknownConversationException.java.ejs',
    owner: 'generated',
    when: (m) => m.features.oidc,
    output: (m) => main(m, 'generated/chat/UnknownConversationException.java'),
  },
  {
    template: 'java/generated/security/SecurityConfiguration.java.ejs',
    owner: 'generated',
    when: (m) => m.features.oidc,
    output: (m) => main(m, 'generated/security/SecurityConfiguration.java'),
  },
  ...['UsageLimits', 'LimitExceededException', 'LimitsConfiguration'].map((name): TemplateEntry => ({
    template: `java/generated/limits/${name}.java.ejs`,
    owner: 'generated',
    when: (m) => m.features.limits,
    output: (m) => main(m, `generated/limits/${name}.java`),
  })),

  {
    template: 'java/generated/cache/ReplyCache.java.ejs',
    owner: 'generated',
    when: (m) => m.features.cache,
    output: (m) => main(m, 'generated/cache/ReplyCache.java'),
  },
  {
    template: 'java/generated/tool/ToolCalls.java.ejs',
    owner: 'generated',
    when: (m) => m.features.trackToolCalls,
    output: (m) => main(m, 'generated/tool/ToolCalls.java'),
  },
  {
    template: 'java/generated/tool/RecordedToolCallback.java.ejs',
    owner: 'generated',
    when: (m) => m.features.trackToolCalls && m.features.mcp,
    output: (m) => main(m, 'generated/tool/RecordedToolCallback.java'),
  },
  {
    template: 'java/generated/tool/HttpTool.java.ejs',
    owner: 'generated',
    each: 'httpTool',
    output: (m, tool) => main(m, `generated/tool/${tool.className}.java`),
  },
  {
    template: 'java/generated/tool/HttpToolProperties.java.ejs',
    owner: 'generated',
    each: 'httpTool',
    output: (m, tool) => main(m, `generated/tool/${tool.className}Properties.java`),
  },
  {
    template: 'java/generated/tool/ToolResponses.java.ejs',
    owner: 'generated',
    when: (m) => m.features.httpTools,
    output: (m) => main(m, 'generated/tool/ToolResponses.java'),
  },
  {
    template: 'java/generated/tool/JavaTool.java.ejs',
    owner: 'generated',
    each: 'javaTool',
    output: (m, tool) => main(m, `generated/tool/${tool.className}.java`),
  },
  {
    template: 'java/generated/tool/ToolHandler.java.ejs',
    owner: 'generated',
    each: 'javaTool',
    output: (m, tool) => main(m, `generated/tool/${tool.handlerInterface}.java`),
  },
  {
    template: 'java/tool/DefaultToolHandler.java.ejs',
    owner: 'user',
    each: 'javaTool',
    output: (m, tool) => main(m, `tool/${tool.handlerClass}.java`),
  },

  {
    template: 'test/ApplicationTests.java.ejs',
    owner: 'merged',
    output: (m) => test(m, `${m.project.applicationClass}Tests.java`),
  },
  {
    template: 'test/ObservabilityTests.java.ejs',
    owner: 'generated',
    when: (m) => m.features.otel || m.features.prometheus,
    output: (m) => test(m, 'ObservabilityTests.java'),
  },
  {
    template: 'test/generated/TestcontainersConfiguration.java.ejs',
    owner: 'generated',
    when: (m) => m.features.jdbcMemory || m.features.limits,
    output: (m) => test(m, 'generated/TestcontainersConfiguration.java'),
  },
  {
    template: 'test/generated/chat/ChatControllerTests.java.ejs',
    owner: 'generated',
    output: (m) => test(m, 'generated/chat/ChatControllerTests.java'),
  },
  {
    template: 'test/generated/tool/HttpToolTests.java.ejs',
    owner: 'generated',
    each: 'httpTool',
    output: (m, tool) => test(m, `generated/tool/${tool.className}Tests.java`),
  },
  {
    template: 'test/generated/tool/ToolResponsesTests.java.ejs',
    owner: 'generated',
    when: (m) => m.features.httpTools,
    output: (m) => test(m, 'generated/tool/ToolResponsesTests.java'),
  },
  {
    template: 'test/generated/tool/JavaToolTests.java.ejs',
    owner: 'generated',
    each: 'javaTool',
    output: (m, tool) => test(m, `generated/tool/${tool.className}Tests.java`),
  },
];
