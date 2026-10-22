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
  /** Copied byte for byte: no EJS, no formatting (third-party files such as the Maven Wrapper). */
  raw?: boolean;
  /** Written with the executable permission (scripts). */
  executable?: boolean;
  when?: (model: GenerationModel) => boolean;
  output: (model: GenerationModel) => string;
  locals?: (model: GenerationModel) => Locals;
}

type HttpTool = Extract<ModelTool, { kind: 'http' }>;
type JavaTool = Extract<ModelTool, { kind: 'java' }>;

/** A template rendered once per tool of the selected kind, available to the template as `item`. */
interface EachEntry<Each extends string, Item> {
  template: string;
  owner: FileOwner;
  each: Each;
  output: (model: GenerationModel, item: Item) => string;
  locals?: (model: GenerationModel, item: Item) => Locals;
}

export type TemplateEntry =
  SingleEntry | EachEntry<'tool', ModelTool> | EachEntry<'httpTool', HttpTool> | EachEntry<'javaTool', JavaTool>;

/** Template sources by name, and how they map to project files. Provided by @gen-agent/templates. */
export interface TemplateSet {
  sources: Record<string, string>;
  entries: TemplateEntry[];
}

export interface GeneratedFile {
  path: string;
  content: string;
  owner: FileOwner;
  executable?: boolean;
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

  const render = async (entry: TemplateEntry, path: string, locals: Locals): Promise<void> => {
    rendered.push({
      path,
      owner: entry.owner,
      content: await renderFile(templates, entry.template, path, model, locals),
    });
  };

  for (const entry of templates.entries) {
    switch (entry.each) {
      case undefined:
        if (entry.when !== undefined && !entry.when(model)) break;
        if (entry.raw === true) {
          rendered.push({
            path: entry.output(model),
            owner: entry.owner,
            content: sourceOf(templates, entry.template),
            ...(entry.executable === true ? { executable: true } : {}),
          });
        } else {
          await render(entry, entry.output(model), entry.locals?.(model) ?? {});
        }
        break;
      case 'tool':
        for (const tool of model.tools)
          await render(entry, entry.output(model, tool), { item: tool, ...entry.locals?.(model, tool) });
        break;
      case 'httpTool':
        for (const tool of model.tools) {
          if (tool.kind === 'http')
            await render(entry, entry.output(model, tool), { item: tool, ...entry.locals?.(model, tool) });
        }
        break;
      case 'javaTool':
        for (const tool of model.tools) {
          if (tool.kind === 'java')
            await render(entry, entry.output(model, tool), { item: tool, ...entry.locals?.(model, tool) });
        }
        break;
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
  const source = sourceOf(templates, name);

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
        xmlText,
        yamlString,
      },
      {
        // No `filename`: with one, EJS checks partials on disk (fs.existsSync), which breaks in browsers.
        escape: String,
        // Partials are resolved next to the rendered template, from the in-memory set: no file system needed.
        includer: (partial: string) => {
          const key = `${name.slice(0, name.lastIndexOf('/') + 1)}${partial}.ejs`;
          const template = templates.sources[key];
          if (template === undefined) throw new Error(`Partial not found: ${key}`);
          return { template };
        },
      },
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

function sourceOf(templates: TemplateSet, name: string): string {
  const source = templates.sources[name];
  if (source === undefined) throw new Error(`Template not found: ${name}`);
  return source;
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

/** Text content of an XML element. */
export function xmlText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** A YAML scalar, quoted only when needed. */
export function yamlString(value: string): string {
  return /^[\w./-][\w./:-]*$/.test(value) &&
    !/^(true|false|null|yes|no|on|off|~)$/i.test(value) &&
    !/^[\d.]+$/.test(value)
    ? value
    : JSON.stringify(value);
}
