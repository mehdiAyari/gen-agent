import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import JSZip from 'jszip';

const petstore = fileURLToPath(new URL('../../packages/openapi/src/__fixtures__/petstore3.json', import.meta.url));
const output = fileURLToPath(new URL('../output/web-openapi/', import.meta.url));

test('imports an OpenAPI spec in the browser, and the downloaded project passes mvnw verify', async ({ page }) => {
  test.setTimeout(15 * 60 * 1000);
  await page.goto('/en/generator/');
  await page.getByLabel('Name', { exact: true }).first().fill('pet-assistant');

  await page.getByRole('button', { name: 'Import from OpenAPI' }).click();
  const dialog = page.getByRole('dialog', { name: 'Import from an OpenAPI spec' });
  await dialog.getByLabel('Spec file (OpenAPI 3, JSON or YAML)').setInputFiles(petstore);
  // The Petstore spec gives a relative server URL: the base URL is asked for.
  await expect(dialog.getByText('The spec gives no full address for the API')).toBeVisible();
  await dialog.getByLabel('Base URL of the API').fill('https://petstore3.swagger.io/api/v3');
  await expect(dialog.getByText(/Swagger Petstore - OpenAPI 3\.0: \d+ operations can become tools/)).toBeVisible();
  await expect(dialog.getByText(/operations cannot be imported/)).toBeVisible();

  // Keep two operations: the agent needs no more.
  for (const name of await dialog.getByRole('checkbox').all()) await name.uncheck();
  await dialog.getByRole('checkbox', { name: /^get-pet-by-id/ }).check();
  await dialog.getByRole('checkbox', { name: /^find-pets-by-status/ }).check();
  await dialog.getByRole('button', { name: 'Add 2 tools' }).click();

  await expect(page.getByRole('group', { name: 'get-pet-by-id' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'find-pets-by-status' })).toBeVisible();
  await expect(page.getByText('Ready')).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download the project' }).click(),
  ]);
  const zip = await JSZip.loadAsync(readFileSync(await download.path()));
  rmSync(output, { recursive: true, force: true });
  for (const entry of Object.values(zip.files).filter((file) => !file.dir)) {
    const path = join(output, entry.name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, await entry.async('nodebuffer'));
    const mode = Number(entry.unixPermissions ?? 0) & 0o777;
    if (mode !== 0) chmodSync(path, mode);
  }
  const project = join(output, 'pet-assistant');
  expect(readFileSync(join(project, 'agent.yaml'), 'utf8')).toContain(
    'url: https://petstore3.swagger.io/api/v3/pet/{petId}',
  );
  execFileSync(join(project, 'mvnw'), ['--batch-mode', '--no-transfer-progress', 'verify'], {
    cwd: project,
    stdio: 'pipe',
    encoding: 'utf8',
  });
});
