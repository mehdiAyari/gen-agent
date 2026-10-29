// Records the chat page of a running example into e2e/test-results/<example>.webm:
//   pnpm --filter @gen-agent/e2e record-example hr-assistant   sign-in, days off left, a day off booked after its approval
// Needs the example running (docker compose up --build in examples/<example>/app) on Ollama.
// The GIF drops the frames where nothing moves (the model thinking), then keeps 8 frames a second:
//   ffmpeg -i hr-assistant.webm -vf "mpdecimate=hi=512:lo=256:frac=0.1,setpts=N/8/TB,fps=8,scale=900:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse" demo.gif
import { copyFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const base = process.env.BASE_URL ?? 'http://localhost:8080';
const example = process.argv[2] ?? 'hr-assistant';
if (example !== 'hr-assistant') throw new Error(`No recording for ${example}`);
const target = fileURLToPath(new URL(`../test-results/${example}.webm`, import.meta.url));
const size = { width: 1000, height: 760 };

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

const browser = await chromium.launch({ channel: 'chrome', slowMo: 40 });
const context = await browser.newContext({
  viewport: size,
  recordVideo: { dir: mkdtempSync(join(tmpdir(), 'gen-agent-example-')), size },
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

/** Types a message, sends it, and waits for the answer of the agent (a model on a CPU takes its time). */
async function say(text, answered) {
  await click(page.getByLabel('Your message'));
  await page.keyboard.type(text, { delay: 35 });
  await pause(400);
  await click(page.getByRole('button', { name: 'Send' }));
  await answered().waitFor({ timeout: 600_000 });
  await pause(2500);
}

await page.goto(base);
await page.mouse.move(500, 380);
await pause(1200);
await click(page.getByRole('button', { name: 'Sign in' }));
await page.getByLabel('Username or email').waitFor();
await click(page.getByLabel('Username or email'));
await page.keyboard.type('demo', { delay: 60 });
await click(page.getByLabel('Password', { exact: true }));
await page.keyboard.type('demo', { delay: 60 });
await click(page.getByRole('button', { name: 'Sign In' }));
await page.getByLabel('Your message').waitFor();
await pause(1200);

const answers = page.locator('#messages li.agent:not(.pending)');
await say('How many days off do I have left?', () => answers.nth(0));
await say('Please book Friday 6 November 2026 off for me.', () => page.getByRole('button', { name: 'Approve' }));
await click(page.getByRole('button', { name: 'Approve' }));
await answers.nth(2).waitFor({ timeout: 600_000 });
await pause(4000);

await context.close();
await browser.close();
mkdirSync(fileURLToPath(new URL('../test-results/', import.meta.url)), { recursive: true });
copyFileSync(await page.video().path(), target);
console.log(`Saved ${target}`);
