import { GENERATOR_VERSION, validateAgentYaml } from '@gen-agent/core';
import { generateProject } from '@gen-agent/templates';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { defaultForm, emptyTool, formToYaml, type AgentForm } from './agent-form';
import { projectZip } from './project-zip';

const form: AgentForm = {
  ...defaultForm(),
  name: 'zip-bot',
  tools: [{ ...emptyTool(), name: 'clock', type: 'java', description: 'Current time' }],
};

describe('projectZip', () => {
  it('contains exactly the CLI output plus agent.yaml, in a folder named after the agent', async () => {
    const result = await projectZip(form);
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const zip = await JSZip.loadAsync(result.bytes);

    const config = validateAgentYaml(formToYaml(form));
    if (!config.ok) throw new Error('invalid');
    const expected = await generateProject(config.config, GENERATOR_VERSION);

    expect(result.fileName).toBe('zip-bot.zip');
    for (const file of expected) {
      expect(await zip.file(`zip-bot/${file.path}`)?.async('string'), file.path).toBe(file.content);
    }
    expect(await zip.file('zip-bot/agent.yaml')?.async('string')).toBe(formToYaml(form));
    expect(Object.values(zip.files).filter((entry) => !entry.dir)).toHaveLength(expected.length + 1);
  });

  it('keeps mvnw executable once unzipped', async () => {
    const result = await projectZip(form);
    if (!result.ok) throw new Error('invalid');
    const zip = await JSZip.loadAsync(result.bytes);

    expect(Number(zip.file('zip-bot/mvnw')?.unixPermissions ?? 0) & 0o111).not.toBe(0);
  });

  it('refuses an invalid form with the reasons', async () => {
    expect(await projectZip({ ...form, name: 'Bad Name' })).toEqual({
      ok: false,
      errors: [expect.stringMatching(/^agent.name: /)],
    });
  });
});
