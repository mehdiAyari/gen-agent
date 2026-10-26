import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { buildModel, unsupportedFeatures, validateAgentYaml, type Diagnostic, type Provider } from '@gen-agent/core';
import { resolveOpenApi } from '@gen-agent/openapi';
import { generateProject } from '@gen-agent/templates';
import { stringify } from 'yaml';

import { VERSION } from './version.js';

/** Where commands print: the terminal in production, a recorder in tests. */
export interface Output {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface GenerateOptions {
  /** Path of the agent.yaml file, relative to `cwd`. */
  from: string;
  /** Project directory; defaults to the agent name. */
  output?: string;
  cwd: string;
}

/** `gen-agent generate --from agent.yaml`. Returns the process exit code. */
export async function generateCommand(options: GenerateOptions, out: Output): Promise<number> {
  let source: string;
  try {
    source = readFileSync(resolve(options.cwd, options.from), 'utf8');
  } catch {
    out.error(`cannot read ${options.from}`);
    return 1;
  }
  const specDirectory = dirname(resolve(options.cwd, options.from));
  return generateFromSource(
    source,
    options.from,
    { cwd: options.cwd, output: options.output, specDirectory },
    out,
    (directory) => {
      // agent.yaml and its specs go with the project: gen-agent add and update work from there.
      writeFileSync(join(directory, 'agent.yaml'), source);
      for (const spec of specsOf(source)) {
        if (spec.startsWith('/') || spec.split('/').includes('..')) {
          out.warn(`${spec} stays outside the project: gen-agent update will look for it relative to ${directory}`);
          continue;
        }
        mkdirSync(dirname(join(directory, spec)), { recursive: true });
        copyFileSync(resolve(specDirectory, spec), join(directory, spec));
      }
    },
  );
}

export interface NewAnswers {
  name: string;
  /** Only `minimal` is generated in V1; other profiles are refused with the version that brings them. */
  profile?: 'minimal' | 'standard' | 'production';
  description?: string;
  provider: Provider;
  model: string;
  package?: string;
  tools: NewTool[];
}

export type NewTool =
  | { name: string; type: 'http'; description: string; url: string }
  | { name: string; type: 'java'; description: string };

/** The agent.yaml written by `gen-agent new`, from the interactive answers. */
export function agentYamlFromAnswers(answers: NewAnswers): string {
  const agent = {
    name: answers.name,
    ...(answers.description ? { description: answers.description } : {}),
    ...(answers.package ? { package: answers.package } : {}),
    profile: answers.profile ?? 'minimal',
    model: { provider: answers.provider, name: answers.model },
    ...(answers.tools.length > 0 ? { tools: answers.tools } : {}),
  };
  return stringify({ agent }, { lineWidth: 0 });
}

/** `gen-agent new <name>`: writes agent.yaml, then generates the project next to it. */
export async function newCommand(
  answers: NewAnswers,
  options: { cwd: string; output?: string },
  out: Output,
): Promise<number> {
  const yaml = agentYamlFromAnswers(answers);
  return generateFromSource(yaml, 'agent.yaml', { ...options, specDirectory: options.cwd }, out, (directory) => {
    writeFileSync(join(directory, 'agent.yaml'), yaml);
  });
}

async function generateFromSource(
  source: string,
  fileName: string,
  /** `specDirectory`: where the spec paths of `agent.openapi` are relative to. */
  options: { cwd: string; output?: string | undefined; specDirectory: string },
  out: Output,
  beforeWrite?: (directory: string) => void,
): Promise<number> {
  const located = (d: Diagnostic): string =>
    `${fileName}${d.line === undefined ? '' : `:${String(d.line)}`} ${d.path}: ${d.message}`;
  const result = validateAgentYaml(source);
  for (const warning of result.warnings) out.warn(located(warning));
  if (!result.ok) {
    for (const error of result.errors) out.error(located(error));
    return 1;
  }

  let config = result.config;
  if (config.agent.openapi !== undefined) {
    const resolved = resolveOpenApi(config, (spec) => readFileSync(resolve(options.specDirectory, spec), 'utf8'));
    if (!resolved.ok) {
      for (const error of resolved.errors) out.error(`${fileName} ${error}`);
      return 1;
    }
    for (const warning of resolved.warnings) out.warn(`${fileName} ${warning}`);
    config = resolved.file;
  }

  const unsupported = unsupportedFeatures(config);
  if (unsupported.length > 0) {
    out.error(`gen-agent ${VERSION} cannot generate everything this file asks for yet:`);
    for (const issue of unsupported) out.error(`  ${issue}`);
    return 1;
  }

  const directory = resolve(options.cwd, options.output ?? config.agent.name);
  const shown = relative(options.cwd, directory) || '.';
  if (!isEmptyOrMissing(directory)) {
    out.error(`${shown} is not empty: choose another directory with --output (gen-agent never overwrites files)`);
    return 1;
  }

  const files = await generateProject(config, VERSION);
  mkdirSync(directory, { recursive: true });
  beforeWrite?.(directory);
  for (const file of files) {
    mkdirSync(dirname(join(directory, file.path)), { recursive: true });
    writeFileSync(join(directory, file.path), file.content, file.executable === true ? { mode: 0o755 } : {});
  }

  const { secrets, features, ollamaModels, mcpServers } = buildModel(config);
  out.info(
    [
      `Created ${config.agent.name} in ${shown} (${String(files.length)} files). Next steps:`,
      `  cd ${shown}`,
      ...ollamaModels.map((model) => `  ollama pull ${model}`),
      // The MCP servers in containers run from images of their own, built once.
      ...(mcpServers.some((server) => server.kind === 'local' && server.image !== undefined)
        ? ['  ./docker/mcp/build-images.sh']
        : []),
      ...secrets.map((secret) => `  export ${secret}=...`),
      // With Compose, the agent starts with its database, Redis and identity provider.
      features.dockerCompose ? '  docker compose up --build' : '  ./mvnw spring-boot:run',
    ].join('\n'),
  );
  return 0;
}

function isEmptyOrMissing(directory: string): boolean {
  try {
    return readdirSync(directory).length === 0;
  } catch {
    return true;
  }
}

/** Paths of the OpenAPI specs a valid agent.yaml refers to. */
function specsOf(source: string): string[] {
  const result = validateAgentYaml(source);
  return result.ok ? (result.config.agent.openapi ?? []).map((entry) => entry.spec) : [];
}
