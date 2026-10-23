import { JAVA_RESERVED } from '@gen-agent/core';
import { parse } from 'yaml';

/** An HTTP tool of agent.yaml, as written in the file: defaults are left out. */
export interface ImportedTool {
  name: string;
  type: 'http';
  description?: string;
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  auth?: { type: 'bearer'; env: string } | { type: 'header'; name: string; env: string };
  params?: ImportedParam[];
}

interface ImportedParam {
  name: string;
  apiName?: string;
  type: ParamType;
  required?: true;
  description?: string;
  in?: 'query';
}

type ParamType = 'string' | 'number' | 'integer' | 'boolean';

export interface OpenApiImport {
  /** `info.title` of the spec. */
  title: string;
  tools: ImportedTool[];
  /** Operations left out, by operation id (or method and path), and why. */
  skipped: { operation: string; reason: string }[];
  warnings: string[];
}

export type ImportResult = { ok: true; value: OpenApiImport } | { ok: false; errors: string[] };

export interface ImportOptions {
  /** Operation ids (or tool names) to import; all the supported operations otherwise. */
  include?: string[];
  /** Base URL of the API, when the spec gives none or a relative one. */
  baseUrl?: string;
  /** Where the spec was downloaded from: relative server URLs are resolved against it. */
  specUrl?: string;
  /** Prefix of the environment variables holding credentials; derived from the title otherwise. */
  envPrefix?: string;
}

/** More tools than this and models pick the wrong one more often. */
const MAX_TOOLS = 20;

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

type Json = Record<string, unknown>;

/** Thrown while reading an operation: the operation is skipped with this reason. */
class Unsupported extends Error {}

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Operations of an OpenAPI 3.0 or 3.1 spec (YAML or JSON) as agent.yaml HTTP tools. Runs in Node and browsers. */
export function importOpenApi(source: string, options: ImportOptions = {}): ImportResult {
  let document: unknown;
  try {
    document = parse(source);
  } catch (error) {
    return { ok: false, errors: [`the spec is not valid YAML or JSON: ${(error as Error).message}`] };
  }
  if (!isObject(document)) return { ok: false, errors: ['not an OpenAPI 3 spec: no openapi version'] };
  if (document.swagger !== undefined) {
    return {
      ok: false,
      errors: ['Swagger 2.0 is not supported: convert the spec to OpenAPI 3 first (swagger2openapi)'],
    };
  }
  if (typeof document.openapi !== 'string' || !/^3\.[01]\./.test(document.openapi)) {
    return { ok: false, errors: ['not an OpenAPI 3 spec: no openapi version 3.0 or 3.1'] };
  }

  const spec = document;
  const info = isObject(spec.info) ? spec.info : {};
  const title = typeof info.title === 'string' ? info.title : 'API';
  const envPrefix = options.envPrefix ?? envPrefixOf(title);
  const base = baseUrlOf(spec, options);
  if (!base.ok) return { ok: false, errors: [base.error] };

  const operations = operationsOf(spec);
  const include = options.include === undefined ? undefined : new Set(options.include);
  if (include !== undefined) {
    const known = new Set(operations.flatMap((operation) => [operation.id, toolNameOf(operation)]));
    const missing = [...include].filter((name) => !known.has(name));
    if (missing.length > 0)
      return { ok: false, errors: missing.map((name) => `include: no operation ${name} in the spec`) };
  }

  const tools: ImportedTool[] = [];
  const skipped: OpenApiImport['skipped'] = [];
  const warnings: string[] = [];
  const names = new Set<string>();

  for (const operation of operations) {
    const label = operation.id;
    if (include !== undefined && !include.has(operation.id) && !include.has(toolNameOf(operation))) continue;
    if (include === undefined && operation.node.deprecated === true) {
      skipped.push({ operation: label, reason: 'it is deprecated (name it in include to import it anyway)' });
      continue;
    }
    const name = uniqueName(toolNameOf(operation), names);
    const notes: string[] = [];
    try {
      tools.push(toolOf(spec, operation, name, base.url, envPrefix, notes));
      names.add(name);
      warnings.push(...notes.map((note) => `${name}: ${note}`));
    } catch (error) {
      if (!(error instanceof Unsupported)) throw error;
      skipped.push({ operation: label, reason: error.message });
    }
  }

  if (tools.length > MAX_TOOLS) {
    warnings.push(
      `${String(tools.length)} tools: models choose less reliably beyond ${String(MAX_TOOLS)}, keep the ones the agent needs with include`,
    );
  }
  return { ok: true, value: { title, tools, skipped, warnings } };
}

interface Operation {
  /** operationId, else `METHOD /path`. */
  id: string;
  method: (typeof METHODS)[number];
  path: string;
  node: Json;
  /** Parameters declared on the path, shared by its operations. */
  pathParameters: unknown[];
}

function operationsOf(spec: Json): Operation[] {
  const paths = isObject(spec.paths) ? spec.paths : {};
  return Object.entries(paths).flatMap(([path, item]) => {
    const pathItem = isObject(item) ? item : {};
    const pathParameters = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];
    return METHODS.flatMap((method) => {
      const node = pathItem[method];
      if (!isObject(node)) return [];
      const id = typeof node.operationId === 'string' ? node.operationId : `${method.toUpperCase()} ${path}`;
      return [{ id, method, path, node, pathParameters }];
    });
  });
}

function toolOf(
  spec: Json,
  operation: Operation,
  name: string,
  baseUrl: string,
  envPrefix: string,
  notes: string[],
): ImportedTool {
  const params: ImportedParam[] = [];
  const javaNames = new Set<string>();
  const add = (param: ImportedParam, source: 'parameter' | 'body'): void => {
    // PUT /users/{username} with a username in the body: the body one gets another Java name, same API name.
    if (javaNames.has(param.name) && source === 'body') {
      param.apiName ??= param.name;
      param.name = `${param.name}InBody`;
    }
    if (javaNames.has(param.name)) throw new Unsupported(`two of its parameters are both named ${param.name} in Java`);
    javaNames.add(param.name);
    params.push(param);
  };
  const bodyless = operation.method === 'get' || operation.method === 'delete';

  // Path parameters keep their position in the URL template, under their Java name.
  let path = operation.path;
  for (const parameter of parametersOf(spec, operation)) {
    const where = parameter.in;
    const apiName = String(parameter.name);
    // A parameter without a schema is a plain string.
    const schema = parameter.schema === undefined ? { type: 'string' } : resolve(spec, parameter.schema);
    if (where === 'header' || where === 'cookie') {
      if (parameter.required === true)
        throw new Unsupported(`it needs the ${apiName} ${where}, which a tool cannot send`);
      notes.push(`the optional ${apiName} ${where} is left out`);
      continue;
    }
    const type = scalarTypeOf(schema);
    if (type === undefined) {
      if (parameter.required === true || where === 'path') {
        throw new Unsupported(
          `its ${apiName} parameter is ${withArticle(kindOf(schema))}: only single values are supported`,
        );
      }
      notes.push(`the optional ${apiName} parameter (${kindOf(schema)}) is left out`);
      continue;
    }
    const javaName = javaNameOf(apiName);
    const param: ImportedParam = { name: javaName, type };
    if (where === 'path') {
      path = path.replaceAll(`{${apiName}}`, `{${javaName}}`);
      param.required = true;
    } else {
      if (javaName !== apiName) param.apiName = apiName;
      if (parameter.required === true) param.required = true;
      if (!bodyless) param.in = 'query';
    }
    const description = describe(textOf(parameter.description) ?? textOf(schema.description), schema);
    if (description !== undefined) param.description = description;
    add(param, 'parameter');
  }

  if (operation.node.requestBody !== undefined) {
    if (bodyless) {
      notes.push(`its ${operation.method.toUpperCase()} body is left out`);
    } else {
      for (const param of bodyParamsOf(spec, resolve(spec, operation.node.requestBody), notes)) add(param, 'body');
    }
  }

  // Keys in the order a person writes them in agent.yaml; GET, the default method, is left out.
  const description = textOf(operation.node.summary) ?? textOf(operation.node.description);
  const auth = authOf(spec, operation, envPrefix, notes);
  return {
    name,
    type: 'http',
    ...(description === undefined ? {} : { description: sentence(description) }),
    ...(operation.method === 'get'
      ? {}
      : { method: operation.method.toUpperCase() as NonNullable<ImportedTool['method']> }),
    url: `${baseUrl}${path}`,
    ...(auth === undefined ? {} : { auth }),
    ...(params.length > 0 ? { params } : {}),
  };
}

/** Path-level parameters, overridden by the operation's own with the same name and location. */
function parametersOf(spec: Json, operation: Operation): Json[] {
  const own: unknown[] = Array.isArray(operation.node.parameters) ? (operation.node.parameters as unknown[]) : [];
  const merged = new Map<string, Json>();
  for (const raw of [...operation.pathParameters, ...own]) {
    const parameter = resolve(spec, raw);
    merged.set(`${String(parameter.in)}:${String(parameter.name)}`, parameter);
  }
  return [...merged.values()];
}

function bodyParamsOf(spec: Json, body: Json, notes: string[]): ImportedParam[] {
  const content = isObject(body.content) ? body.content : {};
  const mediaType = Object.keys(content).find((type) => /^application\/(?:[\w.-]+\+)?json\b/.test(type));
  if (mediaType === undefined) {
    const types = Object.keys(content).join(', ');
    throw new Unsupported(`the body is ${types === '' ? 'empty' : types}: only JSON bodies are supported`);
  }
  const media = content[mediaType];
  const schema = flatten(spec, resolve(spec, isObject(media) ? (media.schema ?? {}) : {}));
  const required = new Set(Array.isArray(schema.required) ? schema.required.map(String) : []);
  const bodyRequired = body.required === true;
  const properties = isObject(schema.properties) ? schema.properties : {};

  return Object.entries(properties).flatMap(([apiName, raw]): ImportedParam[] => {
    const property = resolve(spec, raw);
    // Set by the server (an id, a creation date): never sent.
    if (property.readOnly === true) return [];
    const isRequired = bodyRequired && required.has(apiName);
    const type = scalarTypeOf(property);
    if (type === undefined) {
      if (isRequired) {
        throw new Unsupported(
          `its body property ${apiName} is ${withArticle(kindOf(property))}: only flat objects are supported`,
        );
      }
      notes.push(`the optional body property ${apiName} (${kindOf(property)}) is left out`);
      return [];
    }
    const javaName = javaNameOf(apiName);
    const param: ImportedParam = { name: javaName, type };
    if (javaName !== apiName) param.apiName = apiName;
    if (isRequired) param.required = true;
    const description = describe(textOf(property.description), property);
    if (description !== undefined) param.description = description;
    return [param];
  });
}

/** A JSON body schema as one object: `allOf` parts are merged, alternatives are refused. */
function flatten(spec: Json, schema: Json): Json {
  for (const keyword of ['oneOf', 'anyOf'] as const) {
    if (schema[keyword] !== undefined) {
      throw new Unsupported(`the JSON body is not a single object (${keyword}): only flat objects are supported`);
    }
  }
  if (Array.isArray(schema.allOf)) {
    const parts = schema.allOf.map((part) => flatten(spec, resolve(spec, part)));
    return {
      type: 'object',
      properties: Object.assign({}, ...parts.map((part) => part.properties ?? {}), schema.properties ?? {}) as Json,
      required: parts.flatMap((part) => (Array.isArray(part.required) ? (part.required as unknown[]) : [])),
    };
  }
  if (schema.type !== undefined && schema.type !== 'object') {
    throw new Unsupported(`the JSON body is ${withArticle(kindOf(schema))}: only flat objects are supported`);
  }
  return schema;
}

/** The first security option whose schemes a tool supports; none when the operation is public. */
function authOf(spec: Json, operation: Operation, envPrefix: string, notes: string[]): ImportedTool['auth'] {
  const options = (Array.isArray(operation.node.security) ? operation.node.security : spec.security) ?? [];
  if (!Array.isArray(options) || options.length === 0) return undefined;
  const components = isObject(spec.components) ? spec.components : {};
  const schemes = isObject(components.securitySchemes) ? components.securitySchemes : {};

  const reasons: string[] = [];
  for (const option of options) {
    const names = isObject(option) ? Object.keys(option) : [];
    // An empty option means "no authentication" is one of the choices.
    if (names.length === 0) return undefined;
    if (names.length > 1) {
      reasons.push('several credentials at once');
      continue;
    }
    const scheme = resolve(spec, schemes[names[0] ?? ''] ?? {});
    if (scheme.type === 'http' && String(scheme.scheme).toLowerCase() === 'bearer') {
      return { type: 'bearer', env: `${envPrefix}_TOKEN` };
    }
    if (scheme.type === 'apiKey' && scheme.in === 'header') {
      return { type: 'header', name: String(scheme.name), env: `${envPrefix}_API_KEY` };
    }
    if (scheme.type === 'oauth2' || scheme.type === 'openIdConnect') {
      notes.push(
        `${scheme.type === 'oauth2' ? 'OAuth 2' : 'OpenID Connect'} is not run by the agent: put an access token in ${envPrefix}_TOKEN (sent as a bearer token)`,
      );
      return { type: 'bearer', env: `${envPrefix}_TOKEN` };
    }
    reasons.push(scheme.type === 'apiKey' ? `API key in ${String(scheme.in)}` : String(scheme.scheme ?? scheme.type));
  }
  throw new Unsupported(
    `its authentication (${reasons.join(', ')}) is not supported: use a bearer token or an API key header`,
  );
}

function baseUrlOf(spec: Json, options: ImportOptions): { ok: true; url: string } | { ok: false; error: string } {
  const trim = (url: string): string => url.replace(/\/+$/, '');
  if (options.baseUrl !== undefined) return { ok: true, url: trim(options.baseUrl) };

  const servers = Array.isArray(spec.servers) ? spec.servers : [];
  const server = isObject(servers[0]) ? servers[0] : { url: '/' };
  const variables = isObject(server.variables) ? server.variables : {};
  const url = (typeof server.url === 'string' ? server.url : '/').replaceAll(/\{([^{}]+)\}/g, (match, name: string) => {
    const variable = variables[name];
    return isObject(variable) && typeof variable.default === 'string' ? variable.default : match;
  });

  if (/^https?:\/\//.test(url)) return { ok: true, url: trim(url) };
  if (options.specUrl !== undefined) return { ok: true, url: trim(new URL(url, options.specUrl).href) };
  return { ok: false, error: `servers: the API URL "${url}" is relative: give the base URL of the API (baseUrl)` };
}

/** Follows local `$ref`s (`#/components/...`); a reference to another file makes the operation unsupported. */
function resolve(spec: Json, node: unknown, seen: ReadonlySet<string> = new Set()): Json {
  if (!isObject(node)) return {};
  const ref = node.$ref;
  if (typeof ref !== 'string') return node;
  if (!ref.startsWith('#/')) {
    throw new Unsupported(`it refers to another file (${ref}): only references inside the spec are supported`);
  }
  if (seen.has(ref)) throw new Unsupported(`its schema refers to itself (${ref})`);
  let target: unknown = spec;
  for (const segment of ref.slice(2).split('/')) {
    const key = segment.replaceAll('~1', '/').replaceAll('~0', '~');
    target = isObject(target) ? target[key] : undefined;
  }
  if (target === undefined) throw new Unsupported(`it refers to ${ref}, which the spec does not define`);
  return resolve(spec, target, new Set([...seen, ref]));
}

function scalarTypeOf(schema: Json): ParamType | undefined {
  // OpenAPI 3.1 writes nullable types as ["integer", "null"].
  const types = typesOf(schema);
  const type = types.length === 1 ? types[0] : types.length === 0 && schema.enum !== undefined ? 'string' : undefined;
  return type === 'string' || type === 'number' || type === 'integer' || type === 'boolean' ? type : undefined;
}

/** The declared types, `null` aside. */
const typesOf = (schema: Json): unknown[] =>
  (Array.isArray(schema.type) ? (schema.type as unknown[]) : [schema.type]).filter((type) => type !== 'null');

/** array, object… for the messages; structure when it has no single type. */
function kindOf(schema: Json): string {
  const types = typesOf(schema);
  return types.length === 1 && typeof types[0] === 'string' ? types[0] : 'structure';
}

const withArticle = (word: string): string => `${/^[aeiou]/.test(word) ? 'an' : 'a'} ${word}`;

/**
 * A description for the model, with what it would not guess: the allowed values, and the format of a string
 * (a date, an email). Numeric formats such as int64 say nothing useful to the model.
 */
function describe(text: string | undefined, schema: Json): string | undefined {
  let result = text === undefined ? undefined : sentence(text);
  const format = scalarTypeOf(schema) === 'string' && typeof schema.format === 'string' ? schema.format : undefined;
  if (format !== undefined) {
    result = result === undefined ? `Format: ${format}.` : `${result.replace(/\.$/, '')} (format: ${format}).`;
  }
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    const values = `One of: ${schema.enum.map(String).join(', ')}.`;
    result = result === undefined ? values : `${result.replace(/\.?$/, '.')} ${values}`;
  }
  return result;
}

const textOf = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

/** One line, as the model reads it in the tool list. */
const sentence = (text: string): string => text.replaceAll(/\s+/g, ' ').trim();

const words = (text: string): string[] =>
  text
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word !== '')
    .map((word) => word.toLowerCase());

function toolNameOf(operation: Operation): string {
  const fromId = typeof operation.node.operationId === 'string' ? words(operation.node.operationId) : [];
  const parts =
    fromId.length > 0
      ? fromId
      : [
          operation.method,
          ...operation.path.split('/').flatMap((segment) => {
            const variable = /^\{(.+)\}$/.exec(segment);
            return variable === null ? words(segment) : ['by', ...words(variable[1] ?? '')];
          }),
        ];
  const name = parts.join('-');
  return /^[a-z]/.test(name) ? name : `op-${name}`;
}

function uniqueName(name: string, taken: ReadonlySet<string>): string {
  let candidate = name;
  for (let suffix = 2; taken.has(candidate); suffix++) candidate = `${name}-${String(suffix)}`;
  return candidate;
}

/** camelCase, never a Java keyword, never starting with a digit. */
function javaNameOf(apiName: string): string {
  const [first = 'value', ...rest] = words(apiName);
  const name = first + rest.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('');
  const safe = /^[a-z]/.test(name) ? name : `p${name}`;
  return JAVA_RESERVED.has(safe) ? `${safe}Value` : safe;
}

/** SHOP for "Shop API", PETSTORE for "Swagger Petstore - OpenAPI 3.0". */
function envPrefixOf(title: string): string {
  const ignored = new Set(['api', 'apis', 'openapi', 'swagger', 'the', 'rest', 'v1', 'v2', 'v3']);
  const kept = title
    .split(/[^A-Za-z0-9]+/)
    .filter((token) => token !== '' && !ignored.has(token.toLowerCase()) && !/^\d+$/.test(token))
    .flatMap(words);
  return (kept.slice(0, 2).join('_') || 'api').toUpperCase();
}
