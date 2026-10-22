import { GENERATOR_VERSION, unsupportedFeatures, validateAgentYaml } from '@gen-agent/core';
import { generateProject } from '@gen-agent/templates';
import type { GeneratedFile } from '@gen-agent/core';
import JSZip from 'jszip';

import { formToYaml, type AgentForm } from './agent-form';

interface Failure {
  ok: false;
  errors: string[];
}
export type ProjectFiles = { ok: true; name: string; yaml: string; files: GeneratedFile[] } | Failure;
export type ProjectZip = { ok: true; fileName: string; bytes: Uint8Array } | Failure;

/** The files the CLI would generate from this form. */
export async function projectFiles(form: AgentForm): Promise<ProjectFiles> {
  const yaml = formToYaml(form);
  const result = validateAgentYaml(yaml);
  if (!result.ok) return { ok: false, errors: result.errors.map((error) => `${error.path}: ${error.message}`) };
  const unsupported = unsupportedFeatures(result.config);
  if (unsupported.length > 0) return { ok: false, errors: unsupported };
  return {
    ok: true,
    name: result.config.agent.name,
    yaml,
    files: await generateProject(result.config, GENERATOR_VERSION),
  };
}

/** The project the CLI would generate from this form, plus its agent.yaml, zipped in a folder named after the agent. */
export async function projectZip(form: AgentForm): Promise<ProjectZip> {
  const project = await projectFiles(form);
  if (!project.ok) return project;

  const root = project.name;
  const zip = new JSZip();
  for (const file of project.files) {
    // UNIX permissions only survive with platform UNIX: keeps ./mvnw runnable after unzip.
    zip.file(`${root}/${file.path}`, file.content, file.executable === true ? { unixPermissions: 0o755 } : {});
  }
  zip.file(`${root}/agent.yaml`, project.yaml);

  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', platform: 'UNIX' });
  return { ok: true, fileName: `${root}.zip`, bytes };
}
