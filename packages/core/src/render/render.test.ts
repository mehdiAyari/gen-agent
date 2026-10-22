import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { buildModel } from '../model.js';
import { validateAgentYaml } from '../validate.js';
import { javaString, renderProject, xmlText, yamlString, type TemplateSet } from './render.js';

function modelOf(yaml: string) {
  const result = validateAgentYaml(yaml);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return buildModel(result.config);
}

const model = modelOf(`
agent:
  name: demo
  model: { provider: ollama, name: llama3.1 }
  tools:
    - { name: weather-forecast, type: http, url: https://example.org/forecast }
    - { name: book-leave, type: java }
`);

const javaSource = `package <%= project.basePackage %>;

<%- imports %>

public class Hello {
    private final <%= type('java.util.List') %><<%= type('com.example.demo.Local') %>> items = <%= type('java.util.List') %>.of();
<%_ if (withClock) { _%>
    private final <%= type('java.time.Clock') %> clock = <%= type('java.time.Clock') %>.systemUTC();
<%_ } _%>
    String greet() { return <%= javaString(greeting) %>; }
}
`;

function templates(overrides: Partial<Record<string, string>> = {}): TemplateSet {
  return {
    sources: {
      'Hello.java.ejs': javaSource,
      'README.md.ejs': '# <%= project.artifactId %>\n\n\n',
      'Tool.java.ejs':
        'package <%= project.generatedPackage %>.tool;\n\n<%- imports %>\n\nclass <%= item.className %> {}\n',
      ...overrides,
    },
    entries: [
      {
        template: 'Hello.java.ejs',
        owner: 'generated',
        output: (m) => `src/main/java/${m.project.basePackagePath}/Hello.java`,
        locals: () => ({ withClock: false, greeting: 'Say "hi"\n' }),
      },
      { template: 'README.md.ejs', owner: 'merged', output: () => 'README.md' },
      {
        template: 'Tool.java.ejs',
        owner: 'generated',
        each: 'tool',
        output: (m, tool) => `src/main/java/${m.project.basePackagePath}/generated/tool/${tool.className}.java`,
      },
    ],
  };
}

const VERSION = '0.1.0';

describe('renderProject', () => {
  it('imports only the types actually rendered, skips the file own package, and formats Java with 4 spaces', async () => {
    const { files } = await renderProject(model, templates(), VERSION);
    const hello = files.find((f) => f.path.endsWith('Hello.java'));

    expect(hello?.content).toBe(`package com.example.demo;

import java.util.List;

public class Hello {

    private final List<Local> items = List.of();

    String greet() {
        return "Say \\"hi\\"\\n";
    }
}
`);
  });

  it('renders one file per item, and normalizes non-Java files to end with a single newline', async () => {
    const { files } = await renderProject(model, templates(), VERSION);

    expect(files.map((f) => f.path)).toEqual([
      '.gen-agent.json',
      'README.md',
      'src/main/java/com/example/demo/Hello.java',
      'src/main/java/com/example/demo/generated/tool/BookLeaveTool.java',
      'src/main/java/com/example/demo/generated/tool/WeatherForecastTool.java',
    ]);
    expect(files.find((f) => f.path === 'README.md')?.content).toBe('# demo\n');
  });

  it('writes .gen-agent.json with the configuration and the owner and fingerprint of every file', async () => {
    const { files } = await renderProject(model, templates(), VERSION);
    const manifest = JSON.parse(files[0]?.content ?? '{}') as {
      generator: unknown;
      config: { agent: { name: string; profile: string } };
      files: Record<string, { owner: string; sha256: string }>;
    };

    expect(manifest.generator).toEqual({ name: 'gen-agent', version: VERSION });
    expect(manifest.config.agent).toMatchObject({ name: 'demo', profile: 'minimal' });
    expect(Object.keys(manifest.files)).toEqual(files.slice(1).map((f) => f.path));
    expect(manifest.files['README.md']).toEqual({
      owner: 'merged',
      sha256: createHash('sha256').update('# demo\n').digest('hex'),
    });
  });

  it('gives the same fingerprint for the same content', async () => {
    const first = await renderProject(model, templates(), VERSION);
    const second = await renderProject(model, templates(), VERSION);

    expect(first.files[0]?.content).toBe(second.files[0]?.content);
  });

  it('includes partials next to the template, from the template set (no file system)', async () => {
    const set: TemplateSet = {
      sources: {
        'docs/page.md.ejs': "Hello <%- include('signature') %>",
        'docs/signature.ejs': '<%= project.artifactId %>',
      },
      entries: [{ template: 'docs/page.md.ejs', owner: 'merged', output: () => 'PAGE.md' }],
    };

    const { files } = await renderProject(model, set, VERSION);

    expect(files.find((f) => f.path === 'PAGE.md')?.content).toBe('Hello demo\n');
  });

  it('exposes the escaping helpers to templates', async () => {
    const set: TemplateSet = {
      sources: { 'x.ejs': "<%= javaString('a') %> <%= xmlText('<b>') %> <%= yamlString('on') %>" },
      entries: [{ template: 'x.ejs', owner: 'merged', output: () => 'X.txt' }],
    };

    const { files } = await renderProject(model, set, VERSION);

    expect(files.find((f) => f.path === 'X.txt')?.content).toBe('"a" &lt;b&gt; "on"\n');
  });

  it('names the template when rendering fails', async () => {
    await expect(renderProject(model, templates({ 'README.md.ejs': '<%= missing.value %>' }), VERSION)).rejects.toThrow(
      /README\.md\.ejs/,
    );
  });

  it('refuses output that still contains template syntax', async () => {
    await expect(renderProject(model, templates({ 'README.md.ejs': '<%%= leftover %>' }), VERSION)).rejects.toThrow(
      /README\.md.*template syntax/,
    );
  });
});

describe('escaping helpers', () => {
  it('escapes Java strings, XML text and YAML scalars', () => {
    expect(javaString('Say "hi"\n')).toBe('"Say \\"hi\\"\\n"');
    expect(xmlText('R&D <team>')).toBe('R&amp;D &lt;team&gt;');
    expect(yamlString('https://example.org/forecast')).toBe('https://example.org/forecast');
    expect(yamlString('yes')).toBe('"yes"');
    expect(yamlString('a: b')).toBe('"a: b"');
  });
});
