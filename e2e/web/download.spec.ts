import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import JSZip from 'jszip';

import { GENERATOR_VERSION, validateAgentYaml } from '@gen-agent/core';
import { generateProject } from '@gen-agent/templates';

const output = fileURLToPath(new URL('../output/web/', import.meta.url));

test('downloads the same project as the CLI, and it passes mvnw verify', async ({ page }) => {
  test.setTimeout(15 * 60 * 1000);
  await page.goto('/en/generator/?example=weather-agent');
  await expect(page.getByRole('navigation', { name: 'Generated files' }).getByText('README.md')).toBeVisible({
    timeout: 30_000,
  });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download the project' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('weather-agent.zip');
  const zip = await JSZip.loadAsync(readFileSync(await download.path()));

  // Parity: the browser renders exactly what the CLI writes for the same agent.yaml.
  const yaml = await zip.file('weather-agent/agent.yaml')?.async('string');
  if (yaml === undefined) throw new Error('agent.yaml missing from the zip');
  const config = validateAgentYaml(yaml);
  if (!config.ok) throw new Error(JSON.stringify(config.errors));
  const expected = await generateProject(config.config, GENERATOR_VERSION);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  expect(entries.map((entry) => entry.name).sort()).toEqual(
    [...expected.map((file) => `weather-agent/${file.path}`), 'weather-agent/agent.yaml'].sort(),
  );
  for (const file of expected) {
    // Binary files (the jar of the wrapper) are compared byte for byte, in base64.
    const format = file.encoding === 'base64' ? 'base64' : 'string';
    expect(await zip.file(`weather-agent/${file.path}`)?.async(format), file.path).toBe(file.content);
  }

  // Unzipped as a user would, permissions included, then built with the Maven Wrapper.
  rmSync(output, { recursive: true, force: true });
  for (const entry of entries) {
    const path = join(output, entry.name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, await entry.async('nodebuffer'));
    const mode = Number(entry.unixPermissions ?? 0) & 0o777;
    if (mode !== 0) chmodSync(path, mode);
  }
  const project = join(output, 'weather-agent');
  execFileSync(join(project, 'mvnw'), ['--batch-mode', '--no-transfer-progress', 'verify'], {
    cwd: project,
    stdio: 'pipe',
    encoding: 'utf8',
  });
});

test('downloads a standard project that passes mvnw verify against real Postgres and Redis', async ({ page }) => {
  test.setTimeout(15 * 60 * 1000);
  await page.goto('/en/generator/');
  await page.getByLabel('Name', { exact: true }).first().fill('desk-agent');
  await page.getByRole('button', { name: 'Standard' }).click();
  await expect(page.getByRole('navigation', { name: 'Generated files' }).getByText('compose.yaml')).toBeVisible({
    timeout: 30_000,
  });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download the project' }).click(),
  ]);
  const zip = await JSZip.loadAsync(readFileSync(await download.path()));
  const project = join(output, '..', 'web-standard');
  rmSync(project, { recursive: true, force: true });
  for (const entry of Object.values(zip.files).filter((file) => !file.dir)) {
    const path = join(project, entry.name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, await entry.async('nodebuffer'));
    const mode = Number(entry.unixPermissions ?? 0) & 0o777;
    if (mode !== 0) chmodSync(path, mode);
  }
  const root = join(project, 'desk-agent');
  execFileSync(join(root, 'mvnw'), ['--batch-mode', '--no-transfer-progress', 'verify'], {
    cwd: root,
    stdio: 'pipe',
    encoding: 'utf8',
  });
});
