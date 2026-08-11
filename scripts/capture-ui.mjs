import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function option(name, fallback) {
  const prefix = `--${name}=`;
  const entry = process.argv.slice(2).find((argument) => argument.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : fallback;
}

const port = Number(option('port', '9333'));
const outputDirectory = resolve(option('output', 'docs/captures/foundation'));
const commit = option('commit', 'unknown');
const releaseTag = option('release', 'local-build');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('The CDP port must be an integer from 1 to 65535.');

mkdirSync(outputDirectory, { recursive: true });
const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => {
  if (!response.ok) throw new Error(`CDP target discovery failed with HTTP ${response.status}.`);
  return response.json();
});
const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
if (!page) throw new Error('No Electron renderer page was available through CDP.');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolveOpen, rejectOpen) => {
  const timer = setTimeout(() => rejectOpen(new Error('CDP WebSocket connection timed out.')), 10_000);
  socket.addEventListener('open', () => {
    clearTimeout(timer);
    resolveOpen();
  }, { once: true });
  socket.addEventListener('error', () => {
    clearTimeout(timer);
    rejectOpen(new Error('CDP WebSocket connection failed. Launch Electron with a loopback debugging port.'));
  }, { once: true });
});

let requestId = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data));
  if (!message.id || !pending.has(message.id)) return;
  const { resolve: resolveRequest, reject: rejectRequest } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) rejectRequest(new Error(`${message.error.code}: ${message.error.message}`));
  else resolveRequest(message.result ?? {});
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
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text ?? 'Renderer evaluation failed.');
  }
  return response.result?.value;
}

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

async function waitFor(expression, label) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await delay(100);
  }
  const diagnostic = await evaluate(`({
    readyState: document.readyState,
    bridge: typeof window.materialTools,
    appShell: Boolean(document.querySelector('.app-shell')),
    bodyText: document.body?.innerText?.slice(0, 800) ?? ''
  })`);
  throw new Error(`Timed out waiting for ${label}. Renderer state: ${JSON.stringify(diagnostic)}`);
}

async function clickTab(label) {
  const clicked = await evaluate(`(() => {
    const item = [...document.querySelectorAll('[role="tab"]')].find((element) => element.textContent?.includes(${JSON.stringify(label)}));
    if (!item) return false;
    item.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Tab was not found: ${label}`);
  await delay(180);
}

const captures = [];
async function capture(name, state, width = 1440, height = 1000, captureBeyondViewport = true) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await delay(180);
  const result = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport });
  const bytes = Buffer.from(result.data, 'base64');
  if (bytes.length < 24 || bytes.toString('ascii', 1, 4) !== 'PNG') throw new Error(`Capture is not a valid PNG: ${name}`);
  const capturedWidth = bytes.readUInt32BE(16);
  const capturedHeight = bytes.readUInt32BE(20);
  const path = resolve(outputDirectory, `${name}.png`);
  writeFileSync(path, bytes);
  captures.push({ file: `${name}.png`, state, width: capturedWidth, height: capturedHeight, bytes: bytes.length });
  console.log(`Captured ${name}: ${capturedWidth}x${capturedHeight}, ${bytes.length} bytes`);
}

await send('Page.enable');
await send('Runtime.enable');
await waitFor("Boolean(document.querySelector('.fact-grid'))", 'the system summary');
await waitFor("document.querySelector('.status-chip')?.textContent?.trim() === 'Fixture'", 'the privacy-safe documentation fixture');

await capture('overview-dark', 'Overview, dark theme, English, deterministic non-device-specific documentation fixture');

for (const [tab, file] of [
  ['Install', 'install-unavailable'],
  ['Tweaks', 'tweaks-unavailable'],
  ['Config', 'config-unavailable'],
  ['Updates', 'updates-unavailable'],
  ['MicroWin', 'microwin-unavailable'],
]) {
  await clickTab(tab);
  await capture(file, `${tab} destination with an honest unavailable state`);
}

await clickTab('Settings');
await capture('settings-dark', 'Settings, dark theme, all foundation controls', 1440, 1000, true);

await evaluate("document.querySelector('[aria-label=\"Open command palette\"]')?.click(); true");
await waitFor("Boolean(document.querySelector('.command-palette'))", 'the command palette');
await capture('command-palette', 'Command palette opened from the running application');

await evaluate("document.querySelector('.command-palette .regex-builder > summary')?.click(); true");
await waitFor("Boolean(document.querySelector('.command-palette details[open] .popover-surface'))", 'the regex builder');
await capture('regex-builder', 'Command-palette search with its anchored regular expression builder');

await evaluate("document.querySelector('[aria-label=\"Close command palette\"]')?.click(); true");
await clickTab('Settings');
await evaluate(`(() => {
  [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Light')?.click();
  [...document.querySelectorAll('[role="radio"]')].find((button) => button.textContent?.includes('English · 廣東話'))?.click();
  return true;
})()`);
await waitFor("document.querySelector('.app-shell')?.getAttribute('data-theme') === 'light'", 'the light theme');
await waitFor("[...document.querySelectorAll('[role=\"tab\"]')].some((tab) => tab.textContent?.includes('總覽'))", 'bilingual tab labels');
await capture('settings-light-bilingual', 'Settings, light theme, bilingual mode', 1440, 1000, true);

await clickTab('Overview');
await capture('overview-light-bilingual', 'Overview, light theme, bilingual mode');

await clickTab('Settings');
await evaluate(`(() => {
  [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Dark')?.click();
  [...document.querySelectorAll('[role="radio"]')].find((button) => button.textContent?.trim() === 'English')?.click();
  return true;
})()`);
await waitFor("document.querySelector('.app-shell')?.getAttribute('data-theme') === 'dark'", 'the restored dark theme');
await waitFor("![...document.querySelectorAll('[role=\"tab\"]')].some((tab) => tab.textContent?.includes('總覽'))", 'the restored English labels');
await clickTab('Overview');
await waitFor("Boolean(document.querySelector('.fact-grid'))", 'the narrow-layout system summary');
await capture('overview-narrow', 'Overview at a narrow touch layout', 480, 900, false);

await send('Emulation.clearDeviceMetricsOverride');
socket.close();

writeFileSync(resolve(outputDirectory, 'manifest.json'), `${JSON.stringify({
  schemaVersion: 1,
  product: 'Material Tools',
  commit,
  releaseTag,
  source: page.url,
  captureMethod: 'Locally built unsigned Squirrel.Windows package from the stated commit, hidden Win32 desktop, deterministic non-device-specific fixture, Chrome DevTools Protocol Page.captureScreenshot',
  captures,
}, null, 2)}\n`);

console.log(`Wrote ${captures.length} captures and manifest.json to ${outputDirectory}`);
