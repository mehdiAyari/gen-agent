import { GENERATOR_VERSION, unsupportedFeatures, validateAgentYaml } from '@gen-agent/core';
import { generateProject } from '@gen-agent/templates';
import JSZip from 'jszip';

import { formToYaml, type AgentForm } from './agent-form';

export type ProjectZip = { ok: true; fileName: string; bytes: Uint8Array } | { ok: false; errors: string[] };

/** The project the CLI would generate from this form, plus its agent.yaml, zipped in a folder named after the agent. */
export async function projectZip(form: AgentForm): Promise<ProjectZip> {
  const yaml = formToYaml(form);
  const result = validateAgentYaml(yaml);
  if (!result.ok) return { ok: false, errors: result.errors.map((error) => `${error.path}: ${error.message}`) };
  const unsupported = unsupportedFeatures(result.config);
  if (unsupported.length > 0) return { ok: false, errors: unsupported };

  const root = result.config.agent.name;
  const zip = new JSZip();
  for (const file of await generateProject(result.config, GENERATOR_VERSION)) {
    // UNIX permissions only survive with platform UNIX: keeps ./mvnw runnable after unzip.
    zip.file(`${root}/${file.path}`, file.content, file.executable === true ? { unixPermissions: 0o755 } : {});
  }
  zip.file(`${root}/agent.yaml`, yaml);

  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', platform: 'UNIX' });
  return { ok: true, fileName: `${root}.zip`, bytes };
}
