import type { GenerationModel, TemplateEntry } from '@gen-agent/core';

const main = (m: GenerationModel, path: string): string => `src/main/java/${m.project.basePackagePath}/${path}`;
const test = (m: GenerationModel, path: string): string => `src/test/java/${m.project.basePackagePath}/${path}`;

/** Files of the `minimal` profile and their owners (docs/adr/0001-separate-generated-and-user-code.md). */
export const minimalEntries: TemplateEntry[] = [
  { template: 'pom.xml.ejs', owner: 'merged', output: () => 'pom.xml' },
  { template: 'gitignore.ejs', owner: 'merged', output: () => '.gitignore' },
  { template: 'README.md.ejs', owner: 'merged', output: () => 'README.md' },
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
    template: 'test/generated/tool/JavaToolTests.java.ejs',
    owner: 'generated',
    each: 'javaTool',
    output: (m, tool) => test(m, `generated/tool/${tool.className}Tests.java`),
  },
];
