import ejs from 'ejs';
import javaPlugin from 'prettier-plugin-java';
import { format } from 'prettier/standalone';

import type { GenerationModel, ModelTool } from '../model.js';
import { JavaImports } from './java-imports.js';

/** Who owns a generated file: see docs/adr/0001-separate-generated-and-user-code.md. */
export type FileOwner = 'generated' | 'merged' | 'user';

type Locals = Record<string, unknown>;

/** A template rendered once. */
interface SingleEntry {
  template: string;
  owner: FileOwner;
  each?: undefined;
  when?: (model: GenerationModel) => boolean;
  output: (model: GenerationModel) => string;
  locals?: (model: GenerationModel) => Locals;
}

/** A template rendered once per tool, available to the template as `item`. */
interface EachToolEntry {
  template: string;
  owner: FileOwner;
  each: 'tool';
  when?: (model: GenerationModel, tool: ModelTool) => boolean;
  output: (model: GenerationModel, tool: ModelTool) => string;
  locals?: (model: GenerationModel, tool: ModelTool) => Locals;
}

export type TemplateEntry = SingleEntry | EachToolEntry;

/** Template sources by name, and how they map to project files. Provided by @gen-agent/templates. */
export interface TemplateSet {
  sources: Record<string, string>;
  entries: TemplateEntry[];
}

export interface GeneratedFile {
  path: string;
  content: string;
  owner: FileOwner;
}

export const MANIFEST_PATH = '.gen-agent.json';

const JAVA_SOURCE_ROOT = /^src\/(?:main|test)\/java\/(.+)\/[^/]+\.java$/;

/** Renders every template, formats Java with prettier-plugin-java, and adds `.gen-agent.json`. Runs in Node and browsers. */
export async function renderProject(
  model: GenerationModel,
  templates: TemplateSet,
  generatorVersion: string,
): Promise<{ files: GeneratedFile[] }> {
  const rendered: GeneratedFile[] = [];

  for (const entry of templates.entries) {
    if (entry.each === 'tool') {
      for (const tool of model.tools) {
        if (entry.when && !entry.when(model, tool)) continue;
        const path = entry.output(model, tool);
        rendered.push({
          path,
          owner: entry.owner,
          content: await renderFile(templates, entry.template, path, model, {
            item: tool,
            ...entry.locals?.(model, tool),
          }),
        });
      }
    } else {
      if (entry.when && !entry.when(model)) continue;
      const path = entry.output(model);
      rendered.push({
        path,
        owner: entry.owner,
        content: await renderFile(templates, entry.template, path, model, entry.locals?.(model) ?? {}),
      });
    }
  }

  rendered.sort((a, b) => (a.path < b.path ? -1 : 1));
  const manifest = await manifestOf(model, rendered, generatorVersion);
  return { files: [manifest, ...rendered] };
}

async function renderFile(
  templates: TemplateSet,
  name: string,
  path: string,
  model: GenerationModel,
  locals: Locals,
): Promise<string> {
  const source = templates.sources[name];
  if (source === undefined) throw new Error(`Template not found: ${name}`);

  const javaPackage = JAVA_SOURCE_ROOT.exec(path)?.[1]?.replaceAll('/', '.');
  const imports = new JavaImports(javaPackage ?? '');
  const marker = '__GEN_AGENT_IMPORTS__';

  let output: string;
  // No HTML escaping: values reach Java or YAML through the explicit javaString / yamlString helpers.
  try {
    output = ejs.render(
      source,
      {
        ...model,
        ...locals,
        imports: marker,
        type: (qualifiedName: string) => imports.type(qualifiedName),
        staticImport: (qualifiedMember: string) => imports.staticImport(qualifiedMember),
        javaString,
        yamlString,
      },
      { filename: name, escape: String },
    );
  } catch (error) {
    throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }

  if (/<%|%>/.test(output)) throw new Error(`${path}: rendered output still contains template syntax (from ${name})`);

  if (javaPackage === undefined) return `${output.replace(/\s+$/, '')}\n`;
  return format(output.replace(marker, imports.statements()), {
    parser: 'java',
    plugins: [javaPlugin],
    tabWidth: 4,
    printWidth: 120,
  });
}

async function manifestOf(
  model: GenerationModel,
  files: GeneratedFile[],
  generatorVersion: string,
): Promise<GeneratedFile> {
  const entries: Record<string, { owner: FileOwner; sha256: string }> = {};
  for (const file of files) entries[file.path] = { owner: file.owner, sha256: await sha256(file.content) };

  const manifest = {
    generator: { name: 'gen-agent', version: generatorVersion },
    config: { agent: model.agent },
    files: entries,
  };
  return { path: MANIFEST_PATH, owner: 'generated', content: `${JSON.stringify(manifest, null, 2)}\n` };
}

async function sha256(content: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** A Java string literal, quotes included. */
export function javaString(value: string): string {
  return JSON.stringify(value);
}

/** A YAML scalar, quoted only when needed. */
export function yamlString(value: string): string {
  return /^[\w./:-][\w ./:-]*$/.test(value) &&
    !/^(true|false|null|yes|no|on|off|~)$/i.test(value) &&
    !/^[\d.]+$/.test(value)
    ? value
    : JSON.stringify(value);
}
