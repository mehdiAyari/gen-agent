import {
  SUGGESTED_MODELS,
  unsupportedFeatures,
  validateAgentYaml,
  type AgentFile,
  type Provider,
} from '@gen-agent/core';
import { Document, isMap, isSeq, YAMLMap } from 'yaml';

/** Form values: strings for numeric inputs, so a half-typed value is kept and reported instead of lost. */
interface ParamForm {
  name: string;
  type: 'string' | 'number' | 'integer' | 'boolean';
  required: boolean;
  description: string;
  /** HTTP tools only. `auto`: in the path when the URL names it, else query for GET and DELETE, body otherwise. */
  in: 'auto' | 'path' | 'query' | 'body';
}

interface ToolForm {
  name: string;
  type: 'http' | 'java';
  description: string;
  /** HTTP tools only. */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** HTTP tools only. */
  url: string;
  /** HTTP tools only: the header sent with each call, its value read from the environment variable `env`. */
  auth: { type: 'none' | 'bearer' | 'header'; env: string; header: string };
  /** HTTP tools only; empty for the default. */
  maxResponseChars: string;
  params: ParamForm[];
}

export function emptyTool(): ToolForm {
  return {
    name: '',
    type: 'http',
    description: '',
    method: 'GET',
    url: '',
    auth: { type: 'none', env: '', header: '' },
    maxResponseChars: '',
    params: [],
  };
}

export function emptyParam(): ParamForm {
  return { name: '', type: 'string', required: true, description: '', in: 'auto' };
}

export interface AgentForm {
  name: string;
  description: string;
  package: string;
  provider: Provider;
  model: string;
  temperature: string;
  maxTokens: string;
  systemPromptPath: string;
  aiDisclosure: boolean;
  memoryWindow: string;
  euOnly: boolean;
  allowNonEuProviders: boolean;
  tools: ToolForm[];
}

const DEFAULT_PROMPT = 'prompts/system.md';
const DEFAULT_WINDOW = '20';

export function defaultForm(): AgentForm {
  return {
    name: 'my-agent',
    description: '',
    package: '',
    provider: 'mistral',
    model: SUGGESTED_MODELS.mistral,
    temperature: '',
    maxTokens: '',
    systemPromptPath: DEFAULT_PROMPT,
    aiDisclosure: true,
    memoryWindow: DEFAULT_WINDOW,
    euOnly: false,
    allowNonEuProviders: false,
    tools: [],
  };
}

/** A number when the text is one; the raw text otherwise, so the schema reports it on the right field. */
function numberOrText(value: string): number | string {
  const trimmed = value.trim();
  return trimmed !== '' && Number.isFinite(Number(trimmed)) ? Number(trimmed) : trimmed;
}

const present = (value: string): boolean => value.trim() !== '';

/** The agent.yaml content: only what differs from the defaults, in the order a person would write it. */
export function formToYaml(form: AgentForm): string {
  const model: Record<string, unknown> = { provider: form.provider, name: form.model };
  if (present(form.temperature)) model.temperature = numberOrText(form.temperature);
  if (present(form.maxTokens)) model.maxTokens = numberOrText(form.maxTokens);

  const agent: Record<string, unknown> = { name: form.name };
  if (present(form.description)) agent.description = form.description;
  if (present(form.package)) agent.package = form.package;
  agent.model = model;

  const prompt: Record<string, unknown> = {};
  if (form.systemPromptPath !== DEFAULT_PROMPT) prompt.system = form.systemPromptPath;
  if (!form.aiDisclosure) prompt.aiDisclosure = false;
  if (Object.keys(prompt).length > 0) agent.prompt = prompt;

  if (form.memoryWindow !== DEFAULT_WINDOW) agent.memory = { window: numberOrText(form.memoryWindow) };

  if (form.tools.length > 0) {
    agent.tools = form.tools.map((tool) => {
      const written: Record<string, unknown> = { name: tool.name, type: tool.type };
      if (present(tool.description)) written.description = tool.description;
      const http = tool.type === 'http';
      if (http) {
        if (tool.method !== 'GET') written.method = tool.method;
        written.url = tool.url;
        if (tool.auth.type === 'bearer') written.auth = { type: 'bearer', env: tool.auth.env };
        if (tool.auth.type === 'header') written.auth = { type: 'header', name: tool.auth.header, env: tool.auth.env };
        if (present(tool.maxResponseChars)) written.maxResponseChars = numberOrText(tool.maxResponseChars);
      }
      if (tool.params.length > 0) {
        written.params = tool.params.map((param) => ({
          name: param.name,
          type: param.type,
          ...(param.required ? { required: true } : {}),
          ...(present(param.description) ? { description: param.description } : {}),
          ...(http && param.in !== 'auto' ? { in: param.in } : {}),
        }));
      }
      return written;
    });
  }

  if (form.euOnly) agent.gdpr = { euOnly: true, ...(form.allowNonEuProviders ? { allowNonEuProviders: true } : {}) };

  const document = new Document({ agent });
  // Parameters and authentication read best on one line each: { name: latitude, type: number, required: true }.
  const tools = document.getIn(['agent', 'tools']);
  if (isSeq(tools)) {
    for (const tool of tools.items) {
      if (!isMap(tool)) continue;
      const params = tool.get('params');
      if (isSeq(params)) for (const param of params.items) if (param instanceof YAMLMap) param.flow = true;
      const auth = tool.get('auth');
      if (auth instanceof YAMLMap) auth.flow = true;
    }
  }
  return document.toString({ lineWidth: 0 });
}

export type FormFromYaml = { ok: true; form: AgentForm } | { ok: false; errors: string[] };

/** Loads an agent.yaml into the form, or says why it cannot be edited here. */
export function formFromYaml(source: string): FormFromYaml {
  const result = validateAgentYaml(source);
  if (!result.ok) {
    return {
      ok: false,
      errors: result.errors.map(
        (e) => `${e.line === undefined ? '' : `line ${String(e.line)}: `}${e.path}: ${e.message}`,
      ),
    };
  }
  const unsupported = unsupportedFeatures(result.config);
  if (unsupported.length > 0) return { ok: false, errors: unsupported };
  return { ok: true, form: fromConfig(result.config) };
}

function fromConfig({ agent }: AgentFile): AgentForm {
  return {
    name: agent.name,
    description: agent.description ?? '',
    package: agent.package ?? '',
    provider: agent.model.provider,
    model: agent.model.name,
    temperature: agent.model.temperature === undefined ? '' : String(agent.model.temperature),
    maxTokens: agent.model.maxTokens === undefined ? '' : String(agent.model.maxTokens),
    systemPromptPath: agent.prompt.system,
    aiDisclosure: agent.prompt.aiDisclosure,
    memoryWindow: String(agent.memory.window),
    euOnly: agent.gdpr?.euOnly ?? false,
    allowNonEuProviders: agent.gdpr?.allowNonEuProviders ?? false,
    tools: agent.tools.map((tool) => ({
      name: tool.name,
      type: tool.type,
      description: tool.description ?? '',
      method: tool.type === 'http' ? tool.method : 'GET',
      url: tool.type === 'http' ? tool.url : '',
      auth:
        tool.type !== 'http' || tool.auth === undefined
          ? { type: 'none', env: '', header: '' }
          : tool.auth.type === 'bearer'
            ? { type: 'bearer', env: tool.auth.env, header: '' }
            : { type: 'header', env: tool.auth.env, header: tool.auth.name },
      maxResponseChars:
        tool.type === 'http' && tool.maxResponseChars !== undefined ? String(tool.maxResponseChars) : '',
      params: tool.params.map((param) => ({
        name: param.name,
        type: param.type,
        required: param.required,
        description: param.description ?? '',
        in: param.in ?? 'auto',
      })),
    })),
  };
}

/** agent.yaml path → form field. Anything else is reported on the form as a whole (key ''). */
const FIELDS: Record<string, keyof AgentForm> = {
  'agent.name': 'name',
  'agent.description': 'description',
  'agent.package': 'package',
  'agent.model.provider': 'provider',
  'agent.model.name': 'model',
  'agent.model.temperature': 'temperature',
  'agent.model.maxTokens': 'maxTokens',
  'agent.prompt.system': 'systemPromptPath',
  'agent.memory.window': 'memoryWindow',
};

function fieldOf(path: string): string {
  const direct = FIELDS[path];
  if (direct !== undefined) return direct;
  return path.startsWith('agent.tools.') ? path.slice('agent.'.length) : '';
}

/**
 * Where a diagnostic is, in the words of the form: `current-weather › url` rather than `agent.tools.0.url`.
 * Parameters keep their position when unnamed: `current-weather › params.1.name`.
 */
export function describePath(form: AgentForm, path: string): string {
  const tool = /^(?:agent\.)?tools\.(\d+)(?:\.(.+))?$/.exec(path);
  if (tool === null) return path.replace(/^agent\./, '');
  const name = form.tools[Number(tool[1])]?.name.trim() ?? '';
  const label = name === '' ? `tools.${tool[1] ?? ''}` : name;
  return tool[2] === undefined ? label : `${label} › ${tool[2]}`;
}

export interface FormValidation {
  /** Form field path (`tools.0.url`) → message. */
  errors: Record<string, string>;
  warnings: string[];
}

/** Validates the form with the agent.yaml schema of core: one source of truth for the CLI and the web UI. */
export function validateForm(form: AgentForm): FormValidation {
  const result = validateAgentYaml(formToYaml(form));
  const errors: Record<string, string> = {};
  if (!result.ok) {
    for (const error of result.errors) {
      const field = fieldOf(error.path);
      errors[field] ??= error.message;
    }
  }
  return {
    errors,
    warnings: result.warnings.map((warning) => `${describePath(form, warning.path)}: ${warning.message}`),
  };
}
