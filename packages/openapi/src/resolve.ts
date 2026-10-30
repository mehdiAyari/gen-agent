import { validateAgentYaml, type AgentFile } from '@gen-agent/core';
import { stringify } from 'yaml';

import { importOpenApi, type ImportedTool, type ImportOptions } from './import.js';

export type ResolveResult = { ok: true; file: AgentFile; warnings: string[] } | { ok: false; errors: string[] };

/**
 * The agent with the operations of its `openapi` specs added as HTTP tools, after the tools written by hand. The
 * reference is dropped: the result is what the templates generate. `read` returns a spec from its path in agent.yaml.
 */
export function resolveOpenApi(file: AgentFile, read: (spec: string) => string): ResolveResult {
  const entries = file.agent.openapi ?? [];
  if (entries.length === 0) return { ok: true, file, warnings: [] };

  const errors: string[] = [];
  const warnings: string[] = [];
  const imported: ImportedTool[] = [];
  const taken = new Set(file.agent.tools.map((tool) => tool.name));

  entries.forEach((entry, index) => {
    const where = `agent.openapi.${String(index)}`;
    let source: string;
    try {
      source = read(entry.spec);
    } catch (error) {
      errors.push(
        `${where}.spec: cannot read ${entry.spec} (${error instanceof Error ? error.message : String(error)})`,
      );
      return;
    }
    const options: ImportOptions = {};
    if (entry.include !== undefined) options.include = entry.include;
    if (entry.baseUrl !== undefined) options.baseUrl = entry.baseUrl;
    if (entry.auth !== undefined) options.auth = entry.auth;
    const result = importOpenApi(source, options);
    if (!result.ok) {
      errors.push(...result.errors.map((error) => `${where}: ${error}`));
      return;
    }
    // An operation asked for by name must be there; among all of them, the unsupported ones are only reported.
    for (const { operation, reason } of result.value.skipped) {
      if (entry.include === undefined) warnings.push(`${where}: ${operation} skipped: ${reason}`);
      else errors.push(`${where}: ${operation} cannot be imported: ${reason}`);
    }
    warnings.push(...result.value.warnings.map((warning) => `${where}: ${warning}`));
    for (const tool of result.value.tools) {
      if (taken.has(tool.name)) {
        errors.push(
          `${where}: ${tool.name} is already a tool of the agent: list the operations to import with include`,
        );
      } else {
        taken.add(tool.name);
        imported.push(tool);
      }
    }
  });
  if (errors.length > 0) return { ok: false, errors };

  const agent = Object.fromEntries(Object.entries(file.agent).filter(([key]) => key !== 'openapi'));
  const validated = validateAgentYaml(stringify({ agent: { ...agent, tools: [...file.agent.tools, ...imported] } }));
  if (!validated.ok) return { ok: false, errors: validated.errors.map((error) => `${error.path}: ${error.message}`) };

  // Warnings about the hand-written tools were already given when agent.yaml was validated.
  const first = file.agent.tools.length;
  for (const warning of validated.warnings) {
    const index = /^agent\.tools\.(\d+)/.exec(warning.path)?.[1];
    if (index !== undefined && Number(index) >= first) {
      const name = validated.config.agent.tools[Number(index)]?.name ?? warning.path;
      warnings.push(`${name}: ${warning.message}`);
    }
  }
  return { ok: true, file: validated.config, warnings };
}
