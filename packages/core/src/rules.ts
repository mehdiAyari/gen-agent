import { EU_PROVIDERS, type AgentFile } from './schema.js';

/** A problem found in an agent file. `path` uses dots (`agent.tools.0.url`); `line` is 1-based when known. */
export interface Diagnostic {
  path: string;
  message: string;
  line?: number;
}

/** Path segments of a diagnostic, before they are joined and located in the source. */
export interface RuleIssue {
  path: (string | number)[];
  message: string;
}

const SIDE_EFFECT_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Well-known API key formats. A match means a secret was pasted where only `${ENV_VAR}` references are allowed. */
const SECRET_PATTERNS: RegExp[] = [
  /sk-(?:proj-|ant-)?[A-Za-z0-9_-]{16,}/, // OpenAI, Anthropic
  /AKIA[0-9A-Z]{16}/, // AWS access key
  /gh[pousr]_[A-Za-z0-9]{30,}/, // GitHub tokens
  /xox[abprs]-[A-Za-z0-9-]{10,}/, // Slack tokens
  /AIza[0-9A-Za-z_-]{35}/, // Google API key
];

/** Every string in the raw document that looks like a secret, wherever it is. */
export function findSecrets(value: unknown, path: (string | number)[] = []): RuleIssue[] {
  if (typeof value === 'string') {
    return SECRET_PATTERNS.some((pattern) => pattern.test(value))
      ? [
          {
            path,
            message:
              'looks like an API key: secrets are not allowed here, reference an environment variable such as ${API_KEY}',
          },
        ]
      : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findSecrets(item, [...path, index]));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => findSecrets(item, [...path, key]));
  }
  return [];
}

/** Rules that span several fields. Errors make the file invalid; warnings are reported but accepted. */
export function checkRules(file: AgentFile): { errors: RuleIssue[]; warnings: RuleIssue[] } {
  const { agent } = file;
  const errors: RuleIssue[] = [];
  const warnings: RuleIssue[] = [];

  const seen = new Set<string>();
  agent.tools.forEach((tool, index) => {
    if (seen.has(tool.name)) {
      errors.push({ path: ['agent', 'tools', index, 'name'], message: `duplicate tool name "${tool.name}"` });
    }
    seen.add(tool.name);

    if (tool.description === undefined) {
      warnings.push({
        path: ['agent', 'tools', index, 'description'],
        message: 'missing: without a description the model cannot tell when to call this tool',
      });
    }
    if (tool.type === 'http' && SIDE_EFFECT_METHODS.has(tool.method) && tool.approval?.required !== true) {
      warnings.push({
        path: ['agent', 'tools', index],
        message: `${tool.method} has side effects: consider approval.required so a human validates each call`,
      });
    }
  });

  if (agent.gdpr?.euOnly === true && agent.gdpr.allowNonEuProviders !== true) {
    const outsideEu = (provider: string, path: (string | number)[]): void => {
      if (!(EU_PROVIDERS as readonly string[]).includes(provider)) {
        errors.push({
          path,
          message: `"${provider}" is hosted outside the EU, which gdpr.euOnly forbids (set gdpr.allowNonEuProviders to accept it)`,
        });
      }
    };
    outsideEu(agent.model.provider, ['agent', 'model', 'provider']);
    if (agent.model.fallback) outsideEu(agent.model.fallback.provider, ['agent', 'model', 'fallback', 'provider']);
  }

  // Every agent keeps conversation memory (in-memory by default), so a global cache could serve one user's data to another.
  if (agent.cache?.semantic?.scope === 'global') {
    errors.push({
      path: ['agent', 'cache', 'semantic', 'scope'],
      message: 'global is not allowed: answers would leak between users through memory or tools, use scope: user',
    });
  }

  return { errors, warnings };
}
