#!/usr/bin/env node
import { intro, log, outro } from '@clack/prompts';
import { Command, Option } from 'commander';

import { generateCommand, newCommand, type Output } from './commands.js';
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
  .action(async (name: string, options: { profile: 'minimal' | 'standard' | 'production'; output?: string }) => {
    intro(`gen-agent ${VERSION}`);
    const answers = await askNewAnswers(name);
    if (answers === undefined) {
      process.exitCode = 1;
      return;
    }
    process.exitCode = await newCommand(
      { ...answers, profile: options.profile },
      { cwd: process.cwd(), ...options },
      terminal,
    );
    if (process.exitCode === 0) outro('Done.');
  });

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
  .action(async (source: string, options: { include?: string; to: string; expand?: boolean; baseUrl?: string }) => {
    const command: ImportOpenApiOptions = { source, cwd: process.cwd(), to: options.to };
    if (options.include !== undefined) command.include = options.include.split(',').map((id) => id.trim());
    if (options.expand === true) command.expand = true;
    if (options.baseUrl !== undefined) command.baseUrl = options.baseUrl;
    process.exitCode = await importOpenApiCommand(command, terminal);
  });

await program.parseAsync();
