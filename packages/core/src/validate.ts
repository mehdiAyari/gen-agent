import { isMap, isScalar, LineCounter, parseDocument, type Document } from 'yaml';
import type { core } from 'zod';

import { checkRules, findSecrets, type Diagnostic, type RuleIssue } from './rules.js';
import { agentFileSchema, type AgentFile } from './schema.js';

export type { Diagnostic } from './rules.js';

export type ValidationResult =
  { ok: true; config: AgentFile; warnings: Diagnostic[] } | { ok: false; errors: Diagnostic[]; warnings: Diagnostic[] };

/** Parses and validates the content of an `agent.yaml` file, with defaults applied to the returned config. */
export function validateAgentYaml(source: string): ValidationResult {
  const lineCounter = new LineCounter();
  const document = parseDocument(source, { lineCounter, prettyErrors: false, uniqueKeys: true });

  if (document.errors.length > 0) {
    return {
      ok: false,
      errors: document.errors.map((error) => ({
        path: '',
        message: error.message.split('\n')[0] ?? error.message,
        line: lineCounter.linePos(error.pos[0]).line,
      })),
      warnings: [],
    };
  }

  const locate = (issue: RuleIssue): Diagnostic => toDiagnostic(issue, document, lineCounter);
  const raw: unknown = document.toJS();

  const secrets = findSecrets(raw);
  const parsed = agentFileSchema.safeParse(raw);
  if (!parsed.success || secrets.length > 0) {
    const schemaIssues = parsed.success ? [] : parsed.error.issues.flatMap(fromZodIssue);
    return { ok: false, errors: [...secrets, ...schemaIssues].map(locate), warnings: [] };
  }

  const { errors, warnings } = checkRules(parsed.data);
  if (errors.length > 0) {
    return { ok: false, errors: errors.map(locate), warnings: warnings.map(locate) };
  }
  return { ok: true, config: parsed.data, warnings: warnings.map(locate) };
}

function fromZodIssue(issue: core.$ZodIssue): RuleIssue[] {
  const path = issue.path.filter((segment): segment is string | number => typeof segment !== 'symbol');
  if (issue.code === 'unrecognized_keys') {
    return issue.keys.map((key) => ({ path, key, message: `unknown key "${key}"` }));
  }
  if (issue.code === 'invalid_union' && issue.path.at(-1) !== undefined) {
    return [{ path, message: 'invalid value: check the "type" field (http or java) and the fields it requires' }];
  }
  return [{ path, message: issue.message }];
}

function toDiagnostic(issue: RuleIssue & { key?: string }, document: Document, lineCounter: LineCounter): Diagnostic {
  const path = issue.path.join('.');
  const line = lineOf(document, lineCounter, issue.path, issue.key);
  return line === undefined ? { path, message: issue.message } : { path, message: issue.message, line };
}

/** Line of the value at `path` (or of the key `key` inside it), falling back to the closest existing parent. */
function lineOf(
  document: Document,
  lineCounter: LineCounter,
  path: (string | number)[],
  key?: string,
): number | undefined {
  for (let depth = path.length; depth >= 0; depth--) {
    const node = depth === 0 ? document.contents : document.getIn(path.slice(0, depth), true);
    if (key !== undefined && depth === path.length && isMap(node)) {
      const pair = node.items.find((item) => isScalar(item.key) && item.key.value === key);
      const offset = isScalar(pair?.key) ? pair.key.range?.[0] : undefined;
      if (offset !== undefined) return lineCounter.linePos(offset).line;
    }
    const range = (node as { range?: [number, number, number] } | null | undefined)?.range;
    if (range) return lineCounter.linePos(range[0]).line;
  }
  return undefined;
}
