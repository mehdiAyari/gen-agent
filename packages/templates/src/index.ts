import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildModel, renderProject, type AgentFile, type GeneratedFile, type TemplateSet } from '@gen-agent/core';

import { minimalEntries } from './minimal.js';

export { minimalEntries } from './minimal.js';

const MINIMAL_DIR = new URL('../minimal/', import.meta.url);

/** Template set of the `minimal` profile, read from this package (Node only; the web UI will bundle the sources). */
export function minimalTemplates(): TemplateSet {
  const root = fileURLToPath(MINIMAL_DIR);
  const sources: Record<string, string> = {};
  for (const name of readdirSync(root, { recursive: true, encoding: 'utf8' })) {
    if (name.endsWith('.ejs')) sources[name.replaceAll('\\', '/')] = readFileSync(new URL(name, MINIMAL_DIR), 'utf8');
  }
  return { sources, entries: minimalEntries };
}

/** Renders a validated agent file into the files of a Spring AI project. Call `unsupportedFeatures` first. */
export async function generateProject(file: AgentFile, generatorVersion: string): Promise<GeneratedFile[]> {
  const { files } = await renderProject(buildModel(file), minimalTemplates(), generatorVersion);
  return files;
}
