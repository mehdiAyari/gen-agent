import { parse, parseAllDocuments } from 'yaml';

import type { GeneratedFile } from '@gen-agent/core';

/** Imports whose simple name never appears in the rest of the file. */
function unusedImports(content: string): string[] {
  const imports = [...content.matchAll(/^import (?:static )?([\w.]+);$/gm)].map((match) => match[1] ?? '');
  const body = content.replace(/^import .*$/gm, '');
  return imports.filter((name) => !new RegExp(`\\b${name.slice(name.lastIndexOf('.') + 1)}\\b`).test(body));
}

/** Problems of a generated project that no combination of options may cause. */
export function problemsOf(files: GeneratedFile[]): string[] {
  const problems: string[] = [];
  const paths = new Set(files.map((file) => file.path));
  const text = (path: string): string | undefined => files.find((file) => file.path === path)?.content;
  const basePackage = files
    .find((file) => /^src\/main\/java\/.+Application\.java$/.test(file.path))
    ?.content.match(/^package ([\w.]+);/m)?.[1];

  for (const file of files) {
    if (file.encoding === 'base64') continue;
    // Scripts may say undefined (JavaScript, the wrappers copied as they are); rendered files may not.
    const script = /\.(js|cmd|bat)$|(^|\/)(mvnw|gradlew)$/.test(file.path);
    const residue = script ? /<%|%>|\[object Object\]/ : /<%|%>|\bundefined\b|\[object Object\]|\bNaN\b/;
    if (residue.test(file.content)) problems.push(`${file.path}: template residue`);
    if (file.path.endsWith('.java')) {
      for (const name of unusedImports(file.content)) problems.push(`${file.path}: unused import ${name}`);
      // A class of the project it imports must be generated too.
      for (const [, name] of file.content.matchAll(/^import ([\w.]+);$/gm)) {
        if (basePackage === undefined || !name?.startsWith(`${basePackage}.`)) continue;
        const relative = name.slice(basePackage.length + 1).split('.');
        const outer = relative.findIndex((part) => /^[A-Z]/.test(part));
        const source = relative.slice(0, outer + 1).join('/');
        const root = `${basePackage.replaceAll('.', '/')}/${source}.java`;
        if (!paths.has(`src/main/java/${root}`) && !paths.has(`src/test/java/${root}`)) {
          problems.push(`${file.path}: imports ${name}, which is not generated`);
        }
      }
    }
    if (/\.(ya?ml)$/.test(file.path) && !file.path.startsWith('helm/')) {
      for (const document of parseAllDocuments(file.content)) {
        if (document.errors.length > 0)
          problems.push(`${file.path}: invalid YAML (${document.errors[0]?.message ?? ''})`);
      }
    }
    if (file.path.endsWith('.json')) {
      try {
        JSON.parse(file.content);
      } catch {
        problems.push(`${file.path}: invalid JSON`);
      }
    }
  }

  // Every variable application.yml needs without a default is documented in the README.
  const application = text('src/main/resources/application.yml') ?? '';
  const readme = text('README.md') ?? '';
  for (const [, name] of application.matchAll(/\$\{([A-Z][A-Z0-9_]*)\}/g)) {
    if (name !== undefined && !readme.includes(name)) problems.push(`README.md: ${name} is needed but not documented`);
  }

  // Compose runs the services it refers to, with the variables it is given.
  const compose = text('compose.yaml');
  if (compose !== undefined) {
    const services =
      (parse(compose) as { services?: Record<string, { depends_on?: Record<string, unknown> | string[] }> }).services ??
      {};
    for (const [service, definition] of Object.entries(services)) {
      const dependencies = Array.isArray(definition.depends_on)
        ? definition.depends_on
        : Object.keys(definition.depends_on ?? {});
      for (const dependency of dependencies) {
        if (!(dependency in services)) problems.push(`compose.yaml: ${service} depends on ${dependency}, not defined`);
      }
    }
    for (const [, name] of compose.matchAll(/\$\{([A-Z][A-Z0-9_]*)(?::?-[^}]*)?\}/g)) {
      if (name !== undefined && !readme.includes(name))
        problems.push(`README.md: ${name} of compose.yaml is not documented`);
    }
  }

  // Every owner of .gen-agent.json is a file of the project, and the other way round.
  const manifest = JSON.parse(text('.gen-agent.json') ?? '{"files": {}}') as { files: Record<string, unknown> };
  for (const path of Object.keys(manifest.files))
    if (!paths.has(path)) problems.push(`.gen-agent.json: ${path} is not generated`);
  for (const path of paths)
    if (path !== '.gen-agent.json' && !(path in manifest.files)) problems.push(`${path}: not in .gen-agent.json`);

  return problems;
}
