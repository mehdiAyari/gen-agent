// Records e2e/test-results/web-demo.webm: the web generator, from the gallery to a downloaded project.
// Needs the static site built and served: pnpm --filter @gen-agent/web build && node e2e/scripts/serve-web.js
// docs/demo/web-demo.gif is made from it with ffmpeg:
//   ffmpeg -i web-demo.webm -vf "fps=10,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" web-demo.gif
import { copyFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const base = process.env.BASE_URL ?? 'http://localhost:4322';
const target = fileURLToPath(new URL('../test-results/web-demo.webm', import.meta.url));
const size = { width: 1280, height: 800 };

// Videos show no mouse pointer: draw one that follows the mouse events. Runs in the page, hence its globals.
/* global window, document */
const cursor = () => {
  window.addEventListener('DOMContentLoaded', () => {
    const dot = document.createElement('div');
    dot.style.cssText =
      'position:fixed;z-index:99999;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;' +
      'background:rgba(53,122,40,.35);border:2px solid #357a28;pointer-events:none;transition:transform .1s';
    document.body.append(dot);
    document.addEventListener('mousemove', (event) => {
      dot.style.left = `${String(event.clientX)}px`;
      dot.style.top = `${String(event.clientY)}px`;
    });
    document.addEventListener('mousedown', () => (dot.style.transform = 'scale(.7)'));
    document.addEventListener('mouseup', () => (dot.style.transform = ''));
  });
};

const browser = await chromium.launch({ channel: 'chrome', slowMo: 60 });
const context = await browser.newContext({
  viewport: size,
  recordVideo: { dir: mkdtempSync(join(tmpdir(), 'gen-agent-demo-')), size },
});
await context.addInitScript(cursor);
const page = await context.newPage();
const pause = (ms) => page.waitForTimeout(ms);

/** Moves the visible pointer to an element before clicking it, as a person would. */
async function click(locator) {
  const box = await locator.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
  await locator.click();
}

await page.goto(`${base}/en/`);
await page.mouse.move(640, 400);
await pause(2500);
await click(page.getByRole('link', { name: 'See examples' }));
await pause(2000);
await click(page.getByRole('link', { name: 'Open in the generator' }).nth(3));
const files = page.getByRole('navigation', { name: 'Generated files' });
await files.getByText('README.md').waitFor();
await pause(1500);

await click(files.getByRole('button', { name: /CurrentWeatherTool\.java/ }));
await pause(2500);

// Adds a parameter to the tool: the files follow as you type.
const addParam = page.getByRole('button', { name: 'Add a parameter' });
await addParam.scrollIntoViewIfNeeded();
await pause(600);
await click(addParam);
await page.keyboard.type('forecastDays', { delay: 90 });
await click(page.locator('[id="field-tools.0.params.2.type"]'));
await click(page.getByRole('option', { name: 'integer' }));
await pause(2500);

await click(page.getByRole('tab', { name: 'agent.yaml' }));
await pause(3000);
await click(page.getByRole('tab', { name: 'Files' }));
await pause(1000);
await click(page.getByRole('button', { name: 'Download the project' }));
await pause(2500);

await context.close();
await browser.close();
mkdirSync(fileURLToPath(new URL('../test-results/', import.meta.url)), { recursive: true });
copyFileSync(await page.video().path(), target);
console.log(`Saved ${target}`);
