import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function option(name, fallback) {
  const prefix = `--${name}=`;
  const entry = process.argv.slice(2).find((argument) => argument.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : fallback;
}

const port = Number(option('port', '9338'));
const outputDirectory = resolve(option('output', 'docs/captures/site'));
const commit = option('commit', 'unknown');
const pagesRun = option('pages-run', 'unknown');
const expectedOrigin = option('origin', 'https://ding-ding-projects.github.io/material-tools/');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('The CDP port must be an integer from 1 to 65535.');

mkdirSync(outputDirectory, { recursive: true });
const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => {
  if (!response.ok) throw new Error(`CDP target discovery failed with HTTP ${response.status}.`);
  return response.json();
});
const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl && target.url?.startsWith(expectedOrigin));
if (!page) throw new Error(`No live documentation page from ${expectedOrigin} was available through CDP.`);

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolveOpen, rejectOpen) => {
  const timer = setTimeout(() => rejectOpen(new Error('CDP WebSocket connection timed out.')), 10_000);
  socket.addEventListener('open', () => {
    clearTimeout(timer);
    resolveOpen();
  }, { once: true });
  socket.addEventListener('error', () => {
    clearTimeout(timer);
    rejectOpen(new Error('CDP WebSocket connection failed. Launch Edge with a loopback debugging port.'));
  }, { once: true });
});

let requestId = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data));
  if (!message.id || !pending.has(message.id)) return;
  const request = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) request.reject(new Error(`${message.error.code}: ${message.error.message}`));
  else request.resolve(message.result ?? {});
});

function send(method, params = {}) {
  const id = ++requestId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolveRequest, rejectRequest) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      rejectRequest(new Error(`CDP command timed out: ${method}`));
    }, 15_000);
    pending.set(id, {
      resolve: (result) => {
        clearTimeout(timer);
        resolveRequest(result);
      },
      reject: (error) => {
        clearTimeout(timer);
        rejectRequest(error);
      },
    });
  });
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text ?? 'Page evaluation failed.');
  }
  return response.result?.value;
}

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

async function waitFor(expression, label) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await delay(120);
  }
  const diagnostic = await evaluate(`({
    url: location.href,
    readyState: document.readyState,
    title: document.title,
    appShell: Boolean(document.querySelector('.app-shell')),
    bodyText: document.body?.innerText?.slice(0, 900) ?? ''
  })`);
  throw new Error(`Timed out waiting for ${label}. Page state: ${JSON.stringify(diagnostic)}`);
}

async function click(selector, label) {
  const clicked = await evaluate(`(() => {
    const item = document.querySelector(${JSON.stringify(selector)});
    if (!(item instanceof HTMLElement)) return false;
    item.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Control was not found: ${label}`);
  await delay(220);
}

async function clickButtonText(text, label = text) {
  const clicked = await evaluate(`(() => {
    const item = [...document.querySelectorAll('button')].find((button) => button.textContent?.trim().includes(${JSON.stringify(text)}));
    if (!item) return false;
    item.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Button was not found: ${label}`);
  await delay(220);
}

const captures = [];
async function capture(name, state, width = 1440, height = 1000, captureBeyondViewport = true) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await waitFor("document.fonts.status === 'loaded'", 'document fonts');
  await delay(260);
  const result = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport });
  const bytes = Buffer.from(result.data, 'base64');
  if (bytes.length < 24 || bytes.toString('ascii', 1, 4) !== 'PNG') throw new Error(`Capture is not a valid PNG: ${name}`);
  const capturedWidth = bytes.readUInt32BE(16);
  const capturedHeight = bytes.readUInt32BE(20);
  writeFileSync(resolve(outputDirectory, `${name}.png`), bytes);
  captures.push({ file: `${name}.png`, state, width: capturedWidth, height: capturedHeight, bytes: bytes.length });
  console.log(`Captured ${name}: ${capturedWidth}x${capturedHeight}, ${bytes.length} bytes`);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setEmulatedMedia', {
  media: '',
  features: [
    { name: 'prefers-color-scheme', value: 'light' },
    { name: 'prefers-reduced-motion', value: 'reduce' },
  ],
});
await waitFor("document.readyState === 'complete' && Boolean(document.querySelector('.app-shell'))", 'the live application shell');

await click('#tab-settings', 'Settings tab');
await clickButtonText('Light', 'Light theme control');
await waitFor("document.documentElement.dataset.theme === 'light'", 'the light theme');
await click('#tab-overview', 'Overview tab');
await capture('overview-light', 'Live documentation home, light theme, original wording');

for (const [id, file, label] of [
  ['applications', 'applications-article', 'Applications article'],
  ['tweaks', 'tweaks-article', 'Tweaks article'],
  ['config', 'config-fixes-article', 'Config and Fixes article'],
  ['updates', 'updates-article', 'Updates article'],
  ['automation', 'automation-article', 'Automation article'],
  ['creator', 'win11-creator-article', 'Win11 Creator article'],
]) {
  await click(`#tab-${id}`, `${label} tab`);
  await waitFor(`Boolean(document.querySelector('#panel-${id}'))`, label);
  await capture(file, `Live ${label}`);
}

await click('#tab-settings', 'Settings tab');
await waitFor("Boolean(document.querySelector('#panel-settings'))", 'Settings page');
await capture('settings-light', 'Live Settings page, light theme, original wording');
await evaluate("document.querySelector('#setting-private-vocabulary')?.scrollIntoView({ block: 'start' }); true");
await delay(180);
await capture('private-vocabulary-unloaded', 'Live private-vocabulary upload in its unloaded, local-only state', 1440, 1000, false);

await click('#tab-notifications', 'Notifications tab');
await waitFor("Boolean(document.querySelector('#panel-notifications'))", 'Notifications page');
await capture('notifications', 'Live notification history page');

await clickButtonText('Command palette', 'Command palette button');
await waitFor("Boolean(document.querySelector('.command-palette'))", 'the command palette');
await capture('command-palette', 'Live command palette', 1440, 1000, false);
await click('[aria-label="Open anchored regex builder for Commands and destinations"]', 'Command-palette regex builder');
await waitFor("Boolean(document.querySelector('[role=\"dialog\"][aria-label=\"Regex builder for Commands and destinations\"]'))", 'the command-palette regex builder');
await capture('command-regex-builder', 'Live command palette with its anchored regular-expression builder', 1440, 1000, false);
await clickButtonText('Close', 'Command palette close button');

await clickButtonText('Tab discovery', 'Tab discovery button');
await waitFor("Boolean(document.querySelector('.discovery-panel'))", 'tab discovery');
await capture('tab-discovery', 'Live four-scope tab discovery surface', 1440, 1000, false);
await evaluate("document.querySelector('.discovery-panel button.text-button')?.click(); true");
await delay(180);

await click('#tab-overview', 'Overview tab');
await click('[aria-label="More actions for Overview"]', 'Overview tab menu');
await waitFor("Boolean(document.querySelector('.tab-context-panel'))", 'the Overview tab context menu');
await clickButtonText('Edit tab appearance', 'Edit tab appearance action');
await waitFor("Boolean(document.querySelector('.appearance-editor'))", 'the per-tab appearance editor');
await capture('tab-appearance-editor', 'Live per-tab appearance editor', 1440, 1000, false);
await evaluate("document.querySelector('.appearance-editor button.text-button')?.click(); true");
await delay(180);

await click('#tab-overview', 'Overview tab');
await capture('overview-narrow', 'Live documentation home at a narrow touch layout', 390, 844, false);

await send('Emulation.clearDeviceMetricsOverride');
socket.close();

writeFileSync(resolve(outputDirectory, 'manifest.json'), `${JSON.stringify({
  schemaVersion: 1,
  product: 'Material Tools documentation',
  deployedCommit: commit,
  pagesRun,
  source: page.url,
  captureMethod: 'Live GitHub Pages deployment opened in Microsoft Edge on a hidden Win32 desktop with a fresh profile; Chrome DevTools Protocol Page.captureScreenshot',
  privacyState: 'No private vocabulary file was supplied; original wording remained active.',
  captures,
}, null, 2)}\n`);

console.log(`Wrote ${captures.length} live-site captures and manifest.json to ${outputDirectory}`);
