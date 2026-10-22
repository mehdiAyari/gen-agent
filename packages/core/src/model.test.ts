import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildModel, unsupportedFeatures } from './model.js';
import { validateAgentYaml } from './validate.js';
import type { AgentFile } from './schema.js';

function parse(yaml: string): AgentFile {
  const result = validateAgentYaml(yaml);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.config;
}

const assistant = parse(`
agent:
  name: hr-assistant
  model:
    provider: mistral
    name: mistral-large-latest
    temperature: 0.3
    maxTokens: 2000
  tools:
    - name: weather-forecast
      type: http
      description: Weather forecast
      url: https://api.open-meteo.com/v1/forecast
      params:
        - { name: latitude, type: number, required: true }
        - { name: days, type: integer }
    - name: book-leave
      type: java
      description: Books a day off
      params:
        - { name: date, type: string, required: true }
        - { name: halfDay, type: boolean }
`);

describe('buildModel', () => {
  it('derives Maven coordinates, the Java package and the application class from the agent name', () => {
    const model = buildModel(assistant);

    expect(model.project).toEqual({
      artifactId: 'hr-assistant',
      groupId: 'com.example',
      basePackage: 'com.example.hrassistant',
      basePackagePath: 'com/example/hrassistant',
      generatedPackage: 'com.example.hrassistant.generated',
      applicationClass: 'HrAssistantApplication',
    });
  });

  it('uses agent.package when given, and its parent as Maven groupId', () => {
    const model = buildModel(
      parse('agent:\n  name: bot\n  package: io.acme.hr.bot\n  model: { provider: ollama, name: llama3.1 }\n'),
    );

    expect(model.project).toMatchObject({
      groupId: 'io.acme.hr',
      basePackage: 'io.acme.hr.bot',
      applicationClass: 'BotApplication',
    });
  });

  it('maps each provider to its starter, its non-deprecated properties and its API key variable', () => {
    expect(buildModel(assistant).provider).toEqual({
      id: 'mistral',
      starter: 'spring-ai-starter-model-mistral-ai',
      propertyPrefix: 'spring.ai.mistralai',
      configKey: 'mistralai',
      apiKeyEnv: 'MISTRAL_API_KEY',
      maxTokensProperty: 'max-tokens',
      model: 'mistral-large-latest',
      temperature: 0.3,
      maxTokens: 2000,
    });

    const ollama = buildModel(
      parse('agent:\n  name: bot\n  model: { provider: ollama, name: llama3.1, maxTokens: 500 }\n'),
    );
    expect(ollama.provider).toMatchObject({ apiKeyEnv: undefined, maxTokensProperty: 'num-predict' });
  });

  it('names tools the way a Java developer would, with boxed Java types: the model may omit any argument', () => {
    const [http, java] = buildModel(assistant).tools;

    expect(http).toMatchObject({
      kind: 'http',
      className: 'WeatherForecastTool',
      methodName: 'weatherForecast',
      firstRequiredParam: 'latitude',
      method: 'GET',
      clientMethod: 'get',
      sendsBody: false,
      url: 'https://api.open-meteo.com/v1/forecast',
      params: [
        { name: 'latitude', javaType: 'Double', required: true, sample: '1.0' },
        { name: 'days', javaType: 'Long', required: false, sample: 'null' },
      ],
    });
    expect(java).toMatchObject({
      kind: 'java',
      className: 'BookLeaveTool',
      handlerInterface: 'BookLeaveHandler',
      handlerClass: 'DefaultBookLeaveHandler',
      methodName: 'bookLeave',
      params: [
        { name: 'date', javaType: 'String', required: true, sample: '"test"' },
        { name: 'halfDay', javaType: 'Boolean', required: false, sample: 'null' },
      ],
    });
  });

  it('pins the Spring Boot version Spring AI depends on, and flags which kinds of tools exist', () => {
    const model = buildModel(assistant);

    expect(model.versions).toEqual({ springBoot: '4.1.1', springAi: '2.0.1' });
    expect(model.features).toEqual({ httpTools: true, javaTools: true });
  });

  it('keeps the system prompt as a classpath resource and the memory window', () => {
    const model = buildModel(assistant);

    expect(model.prompt).toEqual({ resource: 'prompts/system.md', aiDisclosure: true });
    expect(model.memory).toEqual({ window: 20 });
  });
});

describe('unsupportedFeatures', () => {
  it('accepts everything the minimal profile generates', () => {
    expect(unsupportedFeatures(assistant)).toEqual([]);
  });

  it('lists what V1 cannot generate yet, with the version that brings it', () => {
    const dossier = parse(readFileSync(new URL('./__fixtures__/spec-example.yaml', import.meta.url), 'utf8'));

    expect(unsupportedFeatures(dossier)).toEqual(
      expect.arrayContaining([
        'agent.profile: "production" arrives in V5 (V1 generates the minimal profile)',
        'agent.springAi: 1.0.0 is not supported, this version of gen-agent generates Spring AI 2.0.1',
        'agent.memory.type: "jdbc" arrives in V4',
        'agent.tools.1.approval: human approval arrives in a later version',
        'agent.mcp: MCP clients arrive in V4',
        'agent.openapi: OpenAPI import arrives in V3',
        'agent.rag: RAG arrives in V5',
      ]),
    );
  });
});
