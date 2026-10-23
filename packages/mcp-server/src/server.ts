import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

import {
  agentJsonSchema,
  buildModel,
  unsupportedFeatures,
  validateAgentYaml,
  type AgentFile,
  type Diagnostic,
  type GeneratedFile,
} from '@gen-agent/core';
import { importOpenApi, resolveOpenApi, type ImportOptions } from '@gen-agent/openapi';
import { generateProject } from '@gen-agent/templates';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Document, isMap, isSeq, YAMLMap } from 'yaml';
import { z } from 'zod';

export interface ServerOptions {
  /** The assistant's workspace: specs are read from it, projects are written into it, never outside. */
  root: string;
  /** Version of gen-agent, recorded in the generated .gen-agent.json. */
  version: string;
}

const INSTRUCTIONS = `gen-agent generates Spring AI agents (Spring Boot, Java 21, Maven) from an agent.yaml file.
Workflow: write the agent.yaml (its JSON Schema is the resource gen-agent://schema/agent.json), check it with
validate_agent, turn an existing API into tools with import_openapi, look at the files with preview_project, then
write the project with generate_project. API keys never go in agent.yaml: only environment variable names.
The generated project builds and tests with ./mvnw verify, without calling any model.`;

const yamlInput = z.string().describe('Content of the agent.yaml file');

/** gen-agent as an MCP server: what the CLI and the web generator do, for coding assistants. */
export function createGenAgentServer(options: ServerOptions): McpServer {
  const root = resolve(options.root);
  const server = new McpServer({ name: 'gen-agent', version: options.version }, { instructions: INSTRUCTIONS });

  server.registerResource(
    'agent-schema',
    'gen-agent://schema/agent.json',
    {
      title: 'agent.yaml JSON Schema',
      description: 'Every key agent.yaml accepts',
      mimeType: 'application/schema+json',
    },
    (uri) => ({ contents: [{ uri: uri.href, text: JSON.stringify(agentJsonSchema(), null, 2) }] }),
  );

  server.registerTool(
    'validate_agent',
    {
      title: 'Validate an agent.yaml',
      description:
        'Checks an agent.yaml against the schema and the rules of gen-agent; reports each problem with its line.',
      inputSchema: { yaml: yamlInput },
      outputSchema: { valid: z.boolean(), errors: z.array(z.string()), warnings: z.array(z.string()) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ yaml }) => {
      const result = prepare(root, yaml);
      const data = {
        valid: result.ok,
        errors: result.ok ? [] : result.errors,
        warnings: result.warnings,
      };
      const text = result.ok
        ? ['agent.yaml is valid.', ...result.warnings.map((warning) => `Warning: ${warning}`)].join('\n')
        : ['agent.yaml is not valid:', ...data.errors, ...result.warnings.map((warning) => `Warning: ${warning}`)].join(
            '\n',
          );
      return { content: [{ type: 'text', text }], structuredContent: data };
    },
  );

  server.registerTool(
    'preview_project',
    {
      title: 'Preview the generated project',
      description:
        'Lists the files gen-agent would generate and who owns each (user: yours to edit; generated: rewritten by ' +
        'gen-agent; merged: shared), and the environment variables to set. Give `file` to read one of them. Writes nothing.',
      inputSchema: {
        yaml: yamlInput,
        file: z.string().optional().describe('Path of a generated file to read, as listed'),
      },
      outputSchema: {
        files: z.array(z.object({ path: z.string(), owner: z.enum(['generated', 'merged', 'user']) })),
        secrets: z.array(z.string()),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ yaml, file }) => {
      const project = await render(root, yaml, options.version);
      if (!project.ok) return failure(project.errors);
      const data = {
        files: project.files.map(({ path, owner }) => ({ path, owner })),
        secrets: buildModel(project.file).secrets,
      };
      if (file !== undefined) {
        const found = project.files.find((candidate) => candidate.path === file);
        if (found === undefined) return failure([`${file} is not generated: pick a path from the list`]);
        return { content: [{ type: 'text', text: found.content }], structuredContent: data };
      }
      const text = [
        `${String(data.files.length)} files:`,
        ...data.files.map(({ path, owner }) => `  ${owner.padEnd(9)} ${path}`),
        ...(data.secrets.length === 0 ? [] : [`Environment variables to set: ${data.secrets.join(', ')}`]),
      ].join('\n');
      return { content: [{ type: 'text', text }], structuredContent: data };
    },
  );

  server.registerTool(
    'import_openapi',
    {
      title: 'Turn an OpenAPI spec into tools',
      description:
        'Reads an OpenAPI 3 spec (a file of the workspace or an https URL) and returns its operations as HTTP tools, in ' +
        'YAML to add under agent.tools, with the operations it cannot import and why.',
      inputSchema: {
        source: z.string().describe('Spec file, relative to the workspace, or https URL'),
        include: z.array(z.string()).optional().describe('Operation ids to import; all the supported ones otherwise'),
        baseUrl: z.string().optional().describe('Base URL of the API, when the spec gives a relative one'),
      },
      outputSchema: {
        title: z.string(),
        tools: z.array(z.record(z.string(), z.unknown())),
        skipped: z.array(z.object({ operation: z.string(), reason: z.string() })),
        warnings: z.array(z.string()),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ source, include, baseUrl }) => {
      const remote = /^https?:\/\//i.test(source);
      let spec: string;
      try {
        if (remote) {
          if (!source.toLowerCase().startsWith('https://'))
            return failure([`only https URLs are downloaded: ${source}`]);
          const response = await fetch(source);
          if (!response.ok) return failure([`${source} answered ${String(response.status)}`]);
          spec = await response.text();
        } else {
          const path = inside(root, source);
          if (path === undefined) return failure([`${source} must stay inside the workspace`]);
          spec = readFileSync(path, 'utf8');
        }
      } catch (error) {
        return failure([`cannot read ${source} (${error instanceof Error ? error.message : String(error)})`]);
      }
      const importOptions: ImportOptions = {};
      if (include !== undefined) importOptions.include = include;
      if (baseUrl !== undefined) importOptions.baseUrl = baseUrl;
      if (remote) importOptions.specUrl = source;
      const result = importOpenApi(spec, importOptions);
      if (!result.ok) return failure(result.errors);

      const { title, tools, skipped, warnings } = result.value;
      const text = [
        `${title}: ${String(tools.length)} tools. Add them under agent.tools:`,
        toolsYaml(tools),
        ...skipped.map(({ operation, reason }) => `Skipped ${operation}: ${reason}`),
        ...warnings.map((warning) => `Warning: ${warning}`),
      ].join('\n');
      return {
        content: [{ type: 'text', text }],
        structuredContent: { title, tools: tools as unknown as Record<string, unknown>[], skipped, warnings },
      };
    },
  );

  server.registerTool(
    'generate_project',
    {
      title: 'Generate the project',
      description:
        'Writes the Spring AI project and its agent.yaml into a new or empty directory of the workspace. Never ' +
        'overwrites a file. The project runs with ./mvnw spring-boot:run and tests with ./mvnw verify.',
      inputSchema: {
        yaml: yamlInput,
        directory: z.string().describe('Project directory, relative to the workspace; new or empty'),
      },
      outputSchema: { directory: z.string(), files: z.number(), secrets: z.array(z.string()) },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ yaml, directory }) => {
      const target = inside(root, directory);
      if (target === undefined) return failure([`${directory} must stay inside the workspace (${root})`]);
      if (!isEmptyOrMissing(target))
        return failure([`${directory} has files: gen-agent never overwrites, pick a new directory`]);

      const project = await render(root, yaml, options.version);
      if (!project.ok) return failure(project.errors);
      mkdirSync(target, { recursive: true });
      writeFileSync(join(target, 'agent.yaml'), yaml);
      for (const file of project.files) {
        mkdirSync(dirname(join(target, file.path)), { recursive: true });
        writeFileSync(join(target, file.path), file.content, file.executable === true ? { mode: 0o755 } : {});
      }

      const { provider, secrets } = buildModel(project.file);
      const shown = relative(root, target) || '.';
      const text = [
        `Created ${project.file.agent.name} in ${shown} (${String(project.files.length + 1)} files). To run it:`,
        `  cd ${shown}`,
        ...(provider.apiKeyEnv === undefined ? [`  ollama pull ${provider.model}`] : []),
        ...secrets.map((secret) => `  export ${secret}=...`),
        '  ./mvnw spring-boot:run',
        'To test it without calling a model: ./mvnw verify',
      ].join('\n');
      return {
        content: [{ type: 'text', text }],
        structuredContent: { directory: shown, files: project.files.length + 1, secrets },
      };
    },
  );

  return server;
}

type Prepared = { ok: true; file: AgentFile; warnings: string[] } | { ok: false; errors: string[]; warnings: string[] };

/** Validates agent.yaml, reads its OpenAPI specs from the workspace, and refuses what cannot be generated yet. */
function prepare(root: string, yaml: string): Prepared {
  const located = (diagnostic: Diagnostic): string =>
    `${diagnostic.line === undefined ? '' : `line ${String(diagnostic.line)}: `}${diagnostic.path}: ${diagnostic.message}`;
  const result = validateAgentYaml(yaml);
  const warnings = result.warnings.map(located);
  if (!result.ok) return { ok: false, errors: result.errors.map(located), warnings };

  let file = result.config;
  if (file.agent.openapi !== undefined) {
    const resolved = resolveOpenApi(file, (spec) => {
      const path = inside(root, spec);
      if (path === undefined) throw new Error('the spec must stay inside the workspace');
      return readFileSync(path, 'utf8');
    });
    if (!resolved.ok) return { ok: false, errors: resolved.errors, warnings };
    warnings.push(...resolved.warnings);
    file = resolved.file;
  }
  const unsupported = unsupportedFeatures(file);
  if (unsupported.length > 0) return { ok: false, errors: unsupported, warnings };
  return { ok: true, file, warnings };
}

async function render(
  root: string,
  yaml: string,
  version: string,
): Promise<{ ok: true; file: AgentFile; files: GeneratedFile[] } | { ok: false; errors: string[] }> {
  const prepared = prepare(root, yaml);
  if (!prepared.ok) return prepared;
  return { ok: true, file: prepared.file, files: await generateProject(prepared.file, version) };
}

/** The absolute path, when it stays inside the workspace. */
function inside(root: string, path: string): string | undefined {
  if (isAbsolute(path)) return undefined;
  const target = resolve(root, path);
  const fromRoot = relative(root, target);
  return fromRoot.startsWith('..') || isAbsolute(fromRoot) ? undefined : target;
}

function isEmptyOrMissing(directory: string): boolean {
  try {
    return readdirSync(directory).length === 0;
  } catch {
    return true;
  }
}

function failure(errors: string[]): CallToolResult {
  return { content: [{ type: 'text', text: errors.join('\n') }], isError: true };
}

/** The tools as YAML list items, parameters and authentication on one line each, ready to paste under agent.tools. */
function toolsYaml(tools: object[]): string {
  const document = new Document(tools);
  if (isSeq(document.contents)) {
    for (const tool of document.contents.items) {
      if (!isMap(tool)) continue;
      const auth = tool.get('auth');
      if (auth instanceof YAMLMap) auth.flow = true;
      const params = tool.get('params');
      if (isSeq(params)) for (const param of params.items) if (param instanceof YAMLMap) param.flow = true;
    }
  }
  return document.toString({ lineWidth: 0 });
}
