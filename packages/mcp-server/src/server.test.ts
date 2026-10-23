import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { beforeEach, describe, expect, it } from 'vitest';

import { createGenAgentServer } from './server.js';

const agentYaml = `agent:
  name: weather-agent
  model: { provider: ollama, name: qwen2.5:3b }
  tools:
    - name: current-weather
      type: http
      description: Current temperature at a location
      url: https://api.open-meteo.com/v1/forecast
      params:
        - { name: latitude, type: number, required: true }
        - { name: longitude, type: number, required: true }
`;

let root: string;
let client: Client;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'gen-agent-mcp-'));
  const server = createGenAgentServer({ root, version: '0.0.0-test' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'test-client', version: '1.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
});

async function call(
  name: string,
  args: Record<string, unknown>,
): Promise<{ text: string; data: Record<string, unknown>; isError: boolean }> {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as { type: string; text: string }[];
  return {
    text: content.map((part) => part.text).join('\n'),
    data: (result.structuredContent ?? {}) as Record<string, unknown>,
    isError: result.isError === true,
  };
}

describe('gen-agent MCP server', () => {
  it('offers its tools, its schema and how to use them', async () => {
    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual([
      'validate_agent',
      'preview_project',
      'import_openapi',
      'generate_project',
    ]);
    expect(tools.find((tool) => tool.name === 'generate_project')?.annotations).toMatchObject({
      destructiveHint: false,
    });
    expect(client.getInstructions()).toMatch(/validate_agent/);
    const schema = await client.readResource({ uri: 'gen-agent://schema/agent.json' });
    expect(JSON.parse((schema.contents[0] as { text: string }).text)).toMatchObject({ title: 'gen-agent agent.yaml' });
  });

  it('validates an agent.yaml and says where each problem is', async () => {
    const valid = await call('validate_agent', { yaml: agentYaml });
    const invalid = await call('validate_agent', { yaml: agentYaml.replace('weather-agent', 'Weather Agent') });

    expect(valid.data).toMatchObject({ valid: true, errors: [] });
    expect(invalid.data).toMatchObject({
      valid: false,
      errors: [expect.stringMatching(/^line 2: agent.name: must be kebab-case/)],
    });
    expect(invalid.isError).toBe(false);
  });

  it('previews the files and who owns them, and shows one on request', async () => {
    const preview = await call('preview_project', { yaml: agentYaml });

    expect(preview.data.files).toContainEqual({ path: 'src/main/resources/prompts/system.md', owner: 'user' });
    expect(preview.data.files).toContainEqual({
      path: 'src/main/java/com/example/weatheragent/generated/tool/CurrentWeatherTool.java',
      owner: 'generated',
    });
    expect(preview.data.secrets).toEqual([]);

    const file = await call('preview_project', { yaml: agentYaml, file: 'src/main/resources/application.yml' });
    expect(file.text).toContain('url: https://api.open-meteo.com/v1/forecast');
  });

  it('turns an OpenAPI spec of the workspace into tools to paste into agent.yaml', async () => {
    copyFileSync(
      new URL('../../openapi/src/__fixtures__/petstore3.json', import.meta.url),
      join(root, 'petstore.json'),
    );

    const result = await call('import_openapi', {
      source: 'petstore.json',
      include: ['getPetById'],
      baseUrl: 'https://petstore3.swagger.io/api/v3',
    });

    expect(result.data).toMatchObject({ tools: [{ name: 'get-pet-by-id' }], skipped: [] });
    expect(result.text).toContain('- name: get-pet-by-id');
    expect(result.text).toContain('url: https://petstore3.swagger.io/api/v3/pet/{petId}');
  });

  it('generates the project into a new directory of the workspace, with its agent.yaml', async () => {
    const result = await call('generate_project', { yaml: agentYaml, directory: 'agents/weather' });

    expect(result.isError).toBe(false);
    expect(readFileSync(join(root, 'agents/weather/agent.yaml'), 'utf8')).toBe(agentYaml);
    expect(existsSync(join(root, 'agents/weather/pom.xml'))).toBe(true);
    expect(statSync(join(root, 'agents/weather/mvnw')).mode & 0o111).not.toBe(0);
    expect(result.text).toMatch(/\.\/mvnw spring-boot:run/);
  });

  it.each([
    ['outside the workspace', '../elsewhere', /must stay inside the workspace/],
    ['an absolute path', '/tmp/agent', /must stay inside the workspace/],
  ])('refuses to write %s', async (_, directory, message) => {
    const result = await call('generate_project', { yaml: agentYaml, directory });

    expect(result.isError).toBe(true);
    expect(result.text).toMatch(message);
  });

  it('never overwrites a directory that has files, and writes nothing for an invalid agent', async () => {
    mkdirSync(join(root, 'taken'));
    writeFileSync(join(root, 'taken/notes.txt'), 'mine');

    expect(await call('generate_project', { yaml: agentYaml, directory: 'taken' })).toMatchObject({ isError: true });
    expect(readFileSync(join(root, 'taken/notes.txt'), 'utf8')).toBe('mine');
    const invalid = await call('generate_project', { yaml: 'agent: {}', directory: 'new' });
    expect(invalid.isError).toBe(true);
    expect(existsSync(join(root, 'new'))).toBe(false);
  });
});
