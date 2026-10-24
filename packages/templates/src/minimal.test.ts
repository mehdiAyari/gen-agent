import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { unsupportedFeatures, validateAgentYaml, type AgentFile, type GeneratedFile } from '@gen-agent/core';

import { minimalEntries } from './minimal.js';
import { generateProject } from './index.js';

const REFERENCES = new URL('../references/', import.meta.url);
const references = readdirSync(REFERENCES).filter((name) => name.endsWith('.yaml'));

function load(name: string): AgentFile {
  const result = validateAgentYaml(readFileSync(new URL(name, REFERENCES), 'utf8'));
  if (!result.ok) throw new Error(`${name}: ${JSON.stringify(result.errors)}`);
  return result.config;
}

/** Imports whose simple name never appears in the rest of the file. */
function unusedImports(content: string): string[] {
  const imports = [...content.matchAll(/^import (?:static )?([\w.]+);$/gm)].map((match) => match[1] ?? '');
  const body = content.replace(/^import .*$/gm, '');
  return imports.filter((name) => !new RegExp(`\\b${name.slice(name.lastIndexOf('.') + 1)}\\b`).test(body));
}

describe.each(references)('reference agent %s', (reference) => {
  const config = load(reference);
  const files = generateProject(config, '0.0.0-test');
  const java = async (): Promise<GeneratedFile[]> => (await files).filter((file) => file.path.endsWith('.java'));

  it('is fully supported by the minimal profile', () => {
    expect(unsupportedFeatures(config)).toEqual([]);
  });

  it('matches the reference snapshots', async () => {
    for (const file of await files) {
      if (file.path === '.gen-agent.json') continue;
      await expect(file.content).toMatchFileSnapshot(`__snapshots__/${reference.replace('.yaml', '')}/${file.path}`);
    }
  });

  it('leaves no trace of templating and no dead imports', async () => {
    // Files copied as they are (scripts of the Maven Wrapper, the chat page) are not rendered: nothing to leak.
    const copied = new Set(
      minimalEntries.flatMap((entry) => (entry.each === undefined && entry.raw === true ? [entry.template] : [])),
    );
    for (const file of await files) {
      if ([...copied].some((template) => file.path.endsWith(template.slice(template.lastIndexOf('/') + 1)))) continue;
      expect(file.content, file.path).not.toMatch(/<%|%>|undefined|\[object Object\]/);
      expect(file.content, file.path).not.toMatch(/\n\n\n/);
    }
    for (const file of await java()) {
      expect(unusedImports(file.content), file.path).toEqual([]);
      expect(file.content, file.path).not.toMatch(/import [\w.]+\.\*;/);
    }
  });

  it('marks every generated-owned Java file and keeps TODOs out of it', async () => {
    for (const file of await java()) {
      if (file.owner !== 'generated') continue;
      expect(file.content, file.path).toMatch(/^\/\/ Managed by gen-agent: /);
      expect(file.content, file.path).not.toMatch(/TODO/);
    }
  });

  it('never puts a secret or a key value in the generated files', async () => {
    const yaml = (await files).find((file) => file.path.endsWith('application.yml'));
    expect(yaml?.content).not.toMatch(/api-key: (?!\$\{)/);
  });
});
