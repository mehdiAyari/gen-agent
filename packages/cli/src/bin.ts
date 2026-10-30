#!/usr/bin/env node
import { PROVIDERS } from '@gen-agent/core';
import { createGenAgentServer } from '@gen-agent/mcp-server';
import { intro, log, outro } from '@clack/prompts';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Command, Option } from 'commander';

import { addMcpCommand, addToolCommand, updateCommand, type AddMcpOptions, type AddToolOptions } from './add.js';
import { answersFromOptions, generateCommand, newCommand, type NewOptions, type Output } from './commands.js';
import { importOpenApiCommand, type ImportOpenApiOptions } from './import-openapi.js';
import { askNewAnswers } from './prompts.js';
import { VERSION } from './version.js';

const terminal: Output = {
  info: (message) => {
    log.message(message);
  },
  warn: (message) => {
    log.warn(message);
  },
  error: (message) => {
    log.error(message);
  },
};

const program = new Command()
  .name('gen-agent')
  .description('Describe your agent, get a production-ready Spring AI project.')
  .version(VERSION);

program
  .command('new')
  .description('create a project by answering a few questions')
  .argument('<name>', 'agent name, in kebab-case (also the project directory)')
  .addOption(
    new Option('--profile <profile>', 'project profile')
      .choices(['minimal', 'standard', 'production'])
      .default('minimal'),
  )
  .option('-o, --output <dir>', 'project directory (default: the agent name)')
  .addOption(new Option('--provider <provider>', 'model provider: no question is asked').choices(PROVIDERS))
  .option('--model <name>', 'model name (default: the one suggested for the provider)')
  .option('--description <text>', 'what the agent does')
  .option('--package <package>', 'Java package (default: com.example.<name>)')
  .action(
    async (name: string, options: NewOptions & { profile: 'minimal' | 'standard' | 'production'; output?: string }) => {
      const given = answersFromOptions(name, options);
      if (given === undefined) intro(`gen-agent ${VERSION}`);
      const answers = given ?? (await askNewAnswers(name));
      if (answers === undefined) {
        process.exitCode = 1;
        return;
      }
      const target = { cwd: process.cwd(), ...(options.output === undefined ? {} : { output: options.output }) };
      process.exitCode = await newCommand({ ...answers, profile: options.profile }, target, terminal);
      if (given === undefined && process.exitCode === 0) outro('Done.');
    },
  );

program
  .command('generate')
  .description('generate a project from an agent.yaml file')
  .requiredOption('-f, --from <file>', 'agent.yaml to read')
  .option('-o, --output <dir>', 'project directory (default: the agent name)')
  .action(async (options: { from: string; output?: string }) => {
    process.exitCode = await generateCommand({ ...options, cwd: process.cwd() }, terminal);
  });

program
  .command('import')
  .description('add tools to an agent from the description of an API')
  .command('openapi')
  .description('add the operations of an OpenAPI 3 spec as HTTP tools')
  .argument('<source>', 'spec file, or https URL')
  .option('--include <operations>', 'comma-separated operation ids to import (default: every supported operation)')
  .option('--to <file>', 'agent.yaml to update', 'agent.yaml')
  .option('--expand', 'copy the tools into agent.yaml instead of referring to the spec')
  .option('--base-url <url>', 'base URL of the API, when the spec gives a relative one')
  .option('--no-auth', 'a public API: no authentication, whatever its spec declares')
  .action(
    async (
      source: string,
      options: { include?: string; to: string; expand?: boolean; baseUrl?: string; auth: boolean },
    ) => {
      const command: ImportOpenApiOptions = { source, cwd: process.cwd(), to: options.to };
      if (options.include !== undefined) command.include = options.include.split(',').map((id) => id.trim());
      if (options.expand === true) command.expand = true;
      if (options.baseUrl !== undefined) command.baseUrl = options.baseUrl;
      if (!options.auth) command.auth = false;
      process.exitCode = await importOpenApiCommand(command, terminal);
    },
  );

const add = program.command('add').description('add to a generated project, keeping your changes');

add
  .command('tool')
  .description('add a tool to the agent, then update the project')
  .argument('<name>', 'tool name, in kebab-case')
  .addOption(new Option('--type <type>', 'what the tool calls').choices(['http', 'java']).default('http'))
  .option('--url <url>', 'URL of an HTTP tool; path parameters written {name}')
  .option('--method <method>', 'method of an HTTP tool (default GET)')
  .option('--description <text>', 'what the tool does: the model reads it to decide when to call it')
  .option(
    '--param <spec...>',
    'parameter as name:type[:required][:description], e.g. "orderId:string:required:the id on the receipt"',
  )
  .option('--approval', 'each call waits for the approval of the user who asked')
  .option('--dir <dir>', 'project directory', '.')
  .action(
    async (
      name: string,
      options: {
        type: 'http' | 'java';
        url?: string;
        method?: string;
        description?: string;
        param?: string[];
        approval?: boolean;
        dir: string;
      },
    ) => {
      const command: AddToolOptions = { name, type: options.type, dir: options.dir, cwd: process.cwd() };
      if (options.url !== undefined) command.url = options.url;
      if (options.method !== undefined) command.method = options.method;
      if (options.description !== undefined) command.description = options.description;
      if (options.param !== undefined) command.params = options.param;
      if (options.approval === true) command.approval = true;
      process.exitCode = await addToolCommand(command, terminal);
    },
  );

add
  .command('mcp')
  .description('add an MCP server to the agent, then update the project')
  .argument('<name>', 'server name, in kebab-case')
  .option('--package <package>', 'npm or PyPI package of a server the agent starts')
  .option('--version <version>', 'exact version of the package')
  .addOption(new Option('--runtime <runtime>', 'how the server runs (default: node)').choices(['node', 'python']))
  .addOption(
    new Option('--sandbox <sandbox>', 'in a throwaway Docker container (default), or on the machine').choices([
      'docker',
      'none',
    ]),
  )
  .option('--arg <arg...>', 'argument of the server')
  .option('--env <name...>', 'name of an environment variable the server gets')
  .option('--url <url>', 'URL of a remote server, over Streamable HTTP')
  .option('--token-env <name>', 'environment variable holding the bearer token of the remote server')
  .option('--dir <dir>', 'project directory', '.')
  .action(
    async (
      name: string,
      options: {
        package?: string;
        version?: string;
        runtime?: 'node' | 'python';
        sandbox?: 'docker' | 'none';
        arg?: string[];
        env?: string[];
        url?: string;
        tokenEnv?: string;
        dir: string;
      },
    ) => {
      const command: AddMcpOptions = { name, dir: options.dir, cwd: process.cwd() };
      if (options.package !== undefined) {
        Object.assign(command, { package: options.package, runtime: options.runtime ?? 'node' });
      }
      if (options.version !== undefined) command.version = options.version;
      if (options.sandbox !== undefined) command.sandbox = options.sandbox;
      if (options.url !== undefined) command.url = options.url;
      if (options.tokenEnv !== undefined) command.tokenEnv = options.tokenEnv;
      if (options.arg !== undefined) command.args = options.arg;
      if (options.env !== undefined) command.env = options.env;
      process.exitCode = await addMcpCommand(command, terminal);
    },
  );

program
  .command('update')
  .description('generate the project again from its agent.yaml, keeping your changes')
  .option('--dir <dir>', 'project directory', '.')
  .action(async (options: { dir: string }) => {
    process.exitCode = await updateCommand({ dir: options.dir, cwd: process.cwd() }, terminal);
  });

program
  .command('mcp')
  .description('run gen-agent as an MCP server on stdio, for coding assistants (Claude Code, Cursor…)')
  .action(async () => {
    // stdout carries the protocol: nothing else is printed there.
    await createGenAgentServer({ root: process.cwd(), version: VERSION }).connect(new StdioServerTransport());
  });

await program.parseAsync();
