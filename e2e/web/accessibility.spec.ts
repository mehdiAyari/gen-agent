import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const path of ['/en/', '/fr/gallery/', '/en/generator/?example=devops-agent']) {
  test(`${path} has no accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    // The generator renders its files after a short pause: check the page once they are there.
    if (path.includes('generator')) {
      await expect(page.getByRole('navigation', { name: 'Generated files' }).getByText('README.md')).toBeVisible({
        timeout: 30_000,
      });
    }

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(
      violations.map(({ id, nodes }) => `${id}: ${nodes.map((node) => node.target.join(' ')).join(', ')}`),
    ).toEqual([]);
  });
}

test('the OpenAPI import dialog has no accessibility violations', async ({ page }) => {
  await page.goto('/en/generator/');
  await page.getByRole('button', { name: 'Import from OpenAPI' }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Spec file (OpenAPI 3, JSON or YAML)')
    .setInputFiles(new URL('../../packages/openapi/src/__fixtures__/petstore3.json', import.meta.url).pathname);
  await dialog.getByLabel('Base URL of the API').fill('https://petstore3.swagger.io/api/v3');
  await expect(dialog.getByRole('checkbox').first()).toBeVisible();

  const { violations } = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();

  expect(violations.map(({ id, nodes }) => `${id}: ${nodes.map((node) => node.target.join(' ')).join(', ')}`)).toEqual(
    [],
  );
});
