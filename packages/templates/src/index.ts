import { buildModel, renderProject, type AgentFile, type GeneratedFile, type TemplateSet } from '@gen-agent/core';

import { minimalEntries } from './minimal.js';
import { MINIMAL_SOURCES } from './minimal-sources.js';

export { minimalEntries } from './minimal.js';

/** Template set of the `minimal` profile. Sources are embedded: works in Node and in browsers alike. */
export function minimalTemplates(): TemplateSet {
  return { sources: MINIMAL_SOURCES, entries: minimalEntries };
}

/** Renders a validated agent file into the files of a Spring AI project. Call `unsupportedFeatures` first. */
export async function generateProject(file: AgentFile, generatorVersion: string): Promise<GeneratedFile[]> {
  const { files } = await renderProject(buildModel(file), minimalTemplates(), generatorVersion);
  return files;
}
