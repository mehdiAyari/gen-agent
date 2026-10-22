import { expect, test, type Page } from '@playwright/test';

/** Waits until the preview lists the files generated for the current form. */
async function filesReady(page: Page): Promise<void> {
  await expect(page.getByRole('navigation', { name: 'Generated files' }).getByText('README.md')).toBeVisible({
    timeout: 30_000,
  });
}

test('keeps the form and agent.yaml in sync, both ways', async ({ page }) => {
  await page.goto('/en/generator/');
  await page.getByLabel('Name', { exact: true }).first().fill('sync-bot');
  await page.getByRole('tab', { name: 'agent.yaml' }).click();
  const editor = page.getByRole('textbox', { name: 'agent.yaml editor' });
  await expect(editor).toContainText('name: sync-bot');

  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText('agent:\n  name: typed-bot\n  model: { provider: ollama, name: llama3.1 }\n');
  await expect(page.getByLabel('Name', { exact: true }).first()).toHaveValue('typed-bot');
  await expect(page.getByRole('button', { name: /Ollama/ })).toHaveAttribute('aria-pressed', 'true');
});

test('previews the generated files with their owner', async ({ page }) => {
  await page.goto('/en/generator/?example=hr-assistant');
  await filesReady(page);
  const files = page.getByRole('navigation', { name: 'Generated files' });

  await files.getByRole('button', { name: /DefaultBookLeaveHandler\.java \(Yours\)/ }).click();
  await expect(page.getByRole('region', { name: /DefaultBookLeaveHandler\.java$/ })).toContainText(
    'implements BookLeaveHandler',
  );
  await expect(files.getByRole('button', { name: /BookLeaveTool\.java \(gen-agent\)/ }).first()).toBeVisible();
});

test('shows errors once a field is left, and points to them instead of downloading', async ({ page }) => {
  await page.goto('/en/generator/');
  const name = page.getByLabel('Name', { exact: true }).first();
  await name.fill('Bad Name');
  await expect(page.getByText(/^must be kebab-case/)).toBeHidden();
  await name.blur();
  await expect(page.getByText(/^must be kebab-case/)).toBeVisible();

  let downloaded = false;
  page.on('download', () => {
    downloaded = true;
  });
  await page.getByLabel('Description', { exact: true }).focus();
  await page.getByRole('button', { name: 'Download the project' }).click();
  await expect(name).toBeFocused();
  expect(downloaded).toBe(false);
});

test('opens an example from the gallery', async ({ page }) => {
  await page.goto('/fr/gallery/');
  await page.getByRole('link', { name: 'Ouvrir dans le générateur' }).first().click();
  await expect(page).toHaveURL(/\/fr\/generator\/$/);
  await expect(page.getByLabel('Nom', { exact: true }).first()).toHaveValue('support-bot');
  await expect(page.getByText('1 avertissement')).toBeVisible();
});

test('undoes the removal of a tool, and keeps the focus on the form', async ({ page }) => {
  await page.goto('/en/generator/?example=devops-agent');
  await expect(page.getByLabel('Name', { exact: true }).first()).toHaveValue('devops-agent');

  await page.getByRole('button', { name: 'Remove github-status' }).click();
  await expect(page.getByRole('group', { name: 'github-status' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add a tool' })).toBeFocused();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('group', { name: 'github-status' })).toBeVisible();
});

test('keeps the agent being edited across a reload and a language switch', async ({ page }) => {
  await page.goto('/en/generator/?example=weather-agent');
  const name = page.getByLabel('Name', { exact: true }).first();
  await expect(name).toHaveValue('weather-agent');
  await expect(page).toHaveURL(/\/en\/generator\/$/);
  await name.fill('my-weather');

  await page.reload();
  await expect(page.getByLabel('Name', { exact: true }).first()).toHaveValue('my-weather');

  await page.getByRole('link', { name: 'Français' }).click();
  await expect(page.getByLabel('Nom', { exact: true }).first()).toHaveValue('my-weather');
});

test('starts over, with a way back', async ({ page }) => {
  await page.goto('/en/generator/?example=support-bot');
  const name = page.getByLabel('Name', { exact: true }).first();
  await expect(name).toHaveValue('support-bot');

  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(name).toHaveValue('my-agent');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(name).toHaveValue('support-bot');
});
