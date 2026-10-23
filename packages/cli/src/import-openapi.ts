import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { validateAgentYaml } from '@gen-agent/core';
import { importOpenApi, resolveOpenApi, type ImportedTool, type ImportOptions } from '@gen-agent/openapi';
import { isMap, isSeq, parseDocument, YAMLMap, YAMLSeq, type Document } from 'yaml';

import type { Output } from './commands.js';

export interface ImportOpenApiOptions {
  /** A spec file, or an https URL. */
  source: string;
  cwd: string;
  /** agent.yaml to add the tools to, relative to `cwd`. */
  to?: string;
  /** Operation ids to import; all the supported ones otherwise. */
  include?: string[];
  /** Copy the tools into agent.yaml instead of referring to the spec. */
  expand?: boolean;
  /** Base URL of the API, when the spec gives a relative one. */
  baseUrl?: string;
}

/** Downloads a spec. Replaced in tests. */
export type FetchText = (url: string) => Promise<string>;

const fetchText: FetchText = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered ${String(response.status)}`);
  return response.text();
};

/** `gen-agent import openapi <file|url>`. Writes nothing unless the agent stays valid. Returns the exit code. */
export async function importOpenApiCommand(
  options: ImportOpenApiOptions,
  out: Output,
  download: FetchText = fetchText,
): Promise<number> {
  const to = options.to ?? 'agent.yaml';
  const agentPath = resolve(options.cwd, to);
  let agentSource: string;
  try {
    agentSource = readFileSync(agentPath, 'utf8');
  } catch {
    out.error(`cannot read ${to}: create the agent first with gen-agent new`);
    return 1;
  }
  const document = parseDocument(agentSource);
  if (document.errors.length > 0 || !isMap(document.get('agent'))) {
    out.error(`${to} is not a valid agent.yaml: check it with gen-agent generate first`);
    return 1;
  }

  const remote = /^https?:\/\//i.test(options.source);
  if (remote && !options.source.toLowerCase().startsWith('https://')) {
    out.error(`only https URLs are downloaded: ${options.source}`);
    return 1;
  }
  let spec: string;
  try {
    spec = remote ? await download(options.source) : readFileSync(resolve(options.cwd, options.source), 'utf8');
  } catch (error) {
    out.error(`cannot read ${options.source} (${error instanceof Error ? error.message : String(error)})`);
    return 1;
  }

  const importOptions: ImportOptions = {};
  if (options.include !== undefined) importOptions.include = options.include;
  if (options.baseUrl !== undefined) importOptions.baseUrl = options.baseUrl;
  if (remote) importOptions.specUrl = options.source;
  const result = importOpenApi(spec, importOptions);
  if (!result.ok) {
    for (const error of result.errors) out.error(error.replace('(baseUrl)', '(--base-url)'));
    return 1;
  }
  const { value } = result;
  for (const { operation, reason } of value.skipped) out.warn(`${operation} skipped: ${reason}`);
  for (const warning of value.warnings) out.warn(warning);
  if (value.tools.length === 0) {
    out.error(`no operation of ${value.title} can become a tool`);
    return 1;
  }
  out.info(
    [
      `${value.title}: ${String(value.tools.length)} tool${value.tools.length > 1 ? 's' : ''}`,
      ...value.tools.map((tool) => `  ${tool.name.padEnd(24)} ${tool.method ?? 'GET'} ${tool.url}`),
    ].join('\n'),
  );

  const agentDirectory = dirname(agentPath);
  let saved: { path: string; content: string } | undefined;
  if (options.expand === true) {
    const taken = new Set(toolNames(document));
    const clash = value.tools.find((tool) => taken.has(tool.name));
    if (clash !== undefined) {
      out.error(`${clash.name} is already a tool of the agent: choose the operations with --include`);
      return 1;
    }
    appendTools(document, value.tools);
  } else {
    let specPath: string;
    if (remote) {
      specPath = specFileFor(agentDirectory, value.shortName, spec);
      saved = { path: specPath, content: spec };
    } else {
      specPath = relative(agentDirectory, resolve(options.cwd, options.source)).split(sep).join('/');
    }
    appendReference(document, {
      spec: specPath,
      ...(options.include === undefined ? {} : { include: options.include }),
      ...(value.baseUrlFromOptions ? { baseUrl: value.baseUrl } : {}),
    });
  }

  // The agent must stay valid with the new tools: nothing is written otherwise.
  const updated = document.toString({ lineWidth: 0 });
  const validated = validateAgentYaml(updated);
  if (!validated.ok) {
    for (const error of validated.errors) out.error(`${to}: ${error.path}: ${error.message}`);
    return 1;
  }
  const read = (path: string): string =>
    path === saved?.path ? saved.content : readFileSync(resolve(agentDirectory, path), 'utf8');
  const resolved = resolveOpenApi(validated.config, read);
  if (!resolved.ok) {
    for (const error of resolved.errors)
      out.error(error.replace('list the operations to import with include', 'choose the operations with --include'));
    return 1;
  }

  if (saved !== undefined) {
    mkdirSync(dirname(resolve(agentDirectory, saved.path)), { recursive: true });
    writeFileSync(resolve(agentDirectory, saved.path), saved.content);
  }
  writeFileSync(agentPath, updated);

  const secrets = [...new Set(value.tools.flatMap((tool) => (tool.auth === undefined ? [] : [tool.auth.env])))];
  out.info(
    [
      `Updated ${to}${saved === undefined ? '' : ` and saved the spec in ${saved.path}`}. Next steps:`,
      ...secrets.map((secret) => `  export ${secret}=...   # credentials of ${value.title}`),
      `  gen-agent generate --from ${to}`,
    ].join('\n'),
  );
  return 0;
}

function toolNames(document: Document): string[] {
  const tools = document.getIn(['agent', 'tools']);
  return isSeq(tools) ? tools.items.flatMap((tool) => (isMap(tool) ? [String(tool.get('name'))] : [])) : [];
}

/** Adds the tools after the existing ones, parameters and authentication on one line each, as people write them. */
function appendTools(document: Document, tools: ImportedTool[]): void {
  const sequence = sequenceAt(document, 'tools');
  for (const tool of tools) {
    const node = document.createNode(tool) as YAMLMap;
    const auth = node.get('auth');
    if (auth instanceof YAMLMap) auth.flow = true;
    const params = node.get('params');
    if (isSeq(params)) for (const param of params.items) if (param instanceof YAMLMap) param.flow = true;
    sequence.items.push(node);
  }
}

function appendReference(document: Document, entry: { spec: string; include?: string[]; baseUrl?: string }): void {
  const node = document.createNode(entry) as YAMLMap;
  const include = node.get('include');
  if (include instanceof YAMLSeq) include.flow = true;
  sequenceAt(document, 'openapi').items.push(node);
}

/** The `agent.<key>` list, created at the end of the agent when missing. */
function sequenceAt(document: Document, key: string): YAMLSeq {
  const existing = document.getIn(['agent', key]);
  if (isSeq(existing)) return existing;
  const sequence = new YAMLSeq();
  document.setIn(['agent', key], sequence);
  return sequence;
}

/** specs/<name>.json (or .yaml), never overwriting a different spec of the same name. */
function specFileFor(directory: string, name: string, content: string): string {
  const extension = content.trimStart().startsWith('{') ? 'json' : 'yaml';
  for (let suffix = 1; ; suffix++) {
    const path = `specs/${name}${suffix === 1 ? '' : `-${String(suffix)}`}.${extension}`;
    const absolute = join(directory, path);
    if (!existsSync(absolute) || readFileSync(absolute, 'utf8') === content) return path;
  }
}
