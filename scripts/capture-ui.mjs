import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { selectSoleCdpPage } from './cdp-target.mjs';

function option(name, fallback) {
  const prefix = `--${name}=`;
  const entry = process.argv.slice(2).find((argument) => argument.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : fallback;
}

const port = Number(option('port', '9333'));
const outputDirectory = resolve(option('output', 'docs/captures/foundation'));
const commit = option('commit', 'unknown');
const releaseTag = option('release', 'local-build');
const expectedUrl = option('url', pathToFileURL(resolve('dist/win-unpacked/resources/app.asar/dist/renderer/index.html')).href);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('The CDP port must be an integer from 1 to 65535.');

mkdirSync(outputDirectory, { recursive: true });
const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => {
  if (!response.ok) throw new Error(`CDP target discovery failed with HTTP ${response.status}.`);
  return response.json();
});
const page = selectSoleCdpPage(targets, expectedUrl, port);

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
async function capture(name, state, width = 1440, height = 1000, captureBeyondViewport = true, mobile = false) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
    ...(mobile ? { screenWidth: width, screenHeight: height } : {}),
  });
  await send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 });
  await waitFor(`(() => {
    const images = [...document.images];
    images.forEach((image) => { image.loading = 'eager'; });
    return images.every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
  })()`, `${name} image readiness`);
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
const vocabularyCacheIsEmpty = await evaluate("localStorage.getItem('material-tools.private-vocabulary.v1') === null");
if (!vocabularyCacheIsEmpty) {
  throw new Error('Capture refused: the selected profile already contains a private-vocabulary cache. Use a fresh disposable profile.');
}
await send('Page.reload', { ignoreCache: true });
await waitFor("document.readyState === 'complete' && Boolean(document.querySelector('.app-shell'))", 'the freshly reloaded application shell');
await waitFor("Boolean(document.querySelector('.fact-grid'))", 'the system summary');
await waitFor("document.querySelector('.status-chip')?.textContent?.trim() === 'Fixture'", 'the privacy-safe documentation fixture');

await capture('overview-dark', 'Overview, dark theme, English, deterministic non-device-specific documentation fixture');

await clickTab('Install');
await waitFor("document.querySelectorAll('.application-card').length === 36", 'the first application-catalog page');
await waitFor("document.body.innerText.includes('startup does not scan automatically')", 'the explicit no-startup-scan state');
await capture('install-catalog', 'Interactive 227-entry application catalog before any package-manager scan', 1440, 1100, false);

const catalogFiltered = await evaluate(`(() => {
  const input = document.querySelector('input[aria-label="Search application catalog"]');
  if (!(input instanceof HTMLInputElement)) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) return false;
  setter.call(input, 'VLC');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);
if (!catalogFiltered) throw new Error('The application-catalog search field was not available.');
await waitFor("document.querySelectorAll('.application-card').length >= 1 && [...document.querySelectorAll('.application-card h3')].some((item) => item.textContent?.includes('VLC'))", 'the VLC plain-text catalog result');
const catalogItemSelected = await evaluate(`(() => {
  const button = [...document.querySelectorAll('.application-card button')]
    .find((item) => item.textContent?.includes('Add to review plan'));
  button?.click();
  return Boolean(button);
})()`);
if (!catalogItemSelected) throw new Error('The catalog review-plan action was not available.');
await waitFor("document.querySelector('#review-plan-title')?.textContent?.includes('1 applications')", 'the one-item review plan');

const readinessStarted = await evaluate(`(() => {
  const button = [...document.querySelectorAll('.manager-section button')]
    .find((item) => item.textContent?.includes('Scan 1 selected'));
  button?.click();
  return Boolean(button);
})()`);
if (!readinessStarted) throw new Error('The selected-item readiness scan was not available.');
await waitFor("document.querySelector('.manager-section')?.textContent?.includes('1 detected states retained')", 'the selected-item readiness result');

const previewStarted = await evaluate(`(() => {
  const button = [...document.querySelectorAll('.operation-workspace button')]
    .find((item) => item.textContent?.includes('Preview install for 1'));
  button?.click();
  return Boolean(button);
})()`);
if (!previewStarted) throw new Error('The application-operation preview action was not available.');
await waitFor("document.querySelector('.operation-preview')?.textContent?.includes('1 ready')", 'the ready application-operation preview');
await waitFor("document.querySelector('.operation-workspace')?.textContent?.includes('No package-manager command runs in this capture')", 'the fixture simulation disclosure');

const upgradeClicked = await evaluate(`(() => {
  const button = [...document.querySelectorAll('.operation-action-row [role="radio"]')]
    .find((item) => item.textContent?.trim() === 'Upgrade');
  button?.click();
  return Boolean(button);
})()`);
if (!upgradeClicked) throw new Error('The upgrade action was not available for stale-preview verification.');
await waitFor("document.querySelector('.operation-preview button') instanceof HTMLButtonElement && document.querySelector('.operation-preview button').disabled && document.querySelector('.operation-preview')?.textContent?.includes('selection or action changed')", 'the stale preview after an action change');
await evaluate(`(() => {
  const button = [...document.querySelectorAll('.operation-action-row [role="radio"]')]
    .find((item) => item.textContent?.trim() === 'Install');
  button?.click();
  return Boolean(button);
})()`);
await waitFor("document.querySelector('.operation-preview button') instanceof HTMLButtonElement && !document.querySelector('.operation-preview button').disabled", 'the restored matching preview action');
await evaluate("document.querySelector('.operation-preview')?.scrollIntoView({ block: 'start' }); true");
await capture('install-preview', 'Selected VLC operation preview with explicit confirmation and fixture disclosure', 1440, 1100, false);

const operationStarted = await evaluate(`(() => {
  const button = [...document.querySelectorAll('.operation-preview button')]
    .find((item) => item.textContent?.includes('Confirm and install 1'));
  button?.click();
  return Boolean(button);
})()`);
if (!operationStarted) throw new Error('The explicit application-operation confirmation was not available.');
await waitFor("Boolean(document.querySelector('.operation-progress'))", 'the application-operation progress surface');
await evaluate("document.querySelector('.operation-progress')?.scrollIntoView({ block: 'start' }); true");
await capture('install-progress', 'Application-operation progress with per-item state and action illustration', 1440, 1100, false);
await waitFor("document.querySelector('.operation-result')?.textContent?.includes('1 succeeded')", 'the fixture application-operation result');
await waitFor("document.querySelector('.operation-result')?.textContent?.includes('no package-manager command ran')", 'the result fixture disclosure');
await evaluate("document.querySelector('.operation-result')?.scrollIntoView({ block: 'start' }); true");
await capture('install-result', 'Completed fixture result with independent verification action and no-command disclosure', 1440, 1100, false);

await send('Page.reload', { ignoreCache: true });
await waitFor("document.readyState === 'complete' && Boolean(document.querySelector('.app-shell'))", 'the reloaded application before cancellation verification');
await clickTab('Install');
await waitFor("document.querySelectorAll('.application-card').length === 36", 'the catalog before cancellation verification');
const cancellationPlanSelected = await evaluate(`(() => {
  const button = [...document.querySelectorAll('.catalog-actions button')]
    .find((item) => item.textContent?.includes('Select up to 25 matches'));
  button?.click();
  return Boolean(button);
})()`);
if (!cancellationPlanSelected) throw new Error('The 25-item selection action was not available.');
await waitFor("document.querySelector('#review-plan-title')?.textContent?.includes('25 applications')", 'the 25-item cancellation plan');
const cancellationPreviewStarted = await evaluate(`(() => {
  const button = [...document.querySelectorAll('.operation-workspace button')]
    .find((item) => item.textContent?.includes('Preview install for 25'));
  button?.click();
  return Boolean(button);
})()`);
if (!cancellationPreviewStarted) throw new Error('The 25-item cancellation preview action was not available.');
await waitFor("Boolean(document.querySelector('.operation-preview'))", 'the 25-item cancellation preview');
const cancellationOperationStarted = await evaluate(`(() => {
  const button = [...document.querySelectorAll('.operation-preview button')]
    .find((item) => item.textContent?.includes('Confirm and install'));
  button?.click();
  return Boolean(button);
})()`);
if (!cancellationOperationStarted) throw new Error('The cancellation operation confirmation was not available.');
await waitFor("[...document.querySelectorAll('.operation-progress button')].some((item) => item.textContent?.includes('Cancel operation'))", 'the in-place cancellation action');
await evaluate(`(() => {
  const button = [...document.querySelectorAll('.operation-progress button')]
    .find((item) => item.textContent?.includes('Cancel operation'));
  button?.click();
  return Boolean(button);
})()`);
await waitFor("document.querySelector('.operation-result')?.textContent?.includes('25 cancelled')", 'the 25-item cancelled result');
await waitFor("![...document.querySelectorAll('.operation-progress button')].some((item) => item.textContent?.includes('Cancel operation'))", 'the terminal cancellation state');
await evaluate("document.querySelector('.operation-result')?.scrollIntoView({ block: 'start' }); true");
await capture('install-cancelled', 'Cancelled 25-item fixture operation with terminal per-item results', 1440, 1100, false);

for (const [tab, file] of [
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

await evaluate("document.querySelector('#setting-private-vocabulary')?.scrollIntoView({ block: 'start' }); true");
await delay(180);
await capture('private-vocabulary-unloaded', 'Private-vocabulary upload in its unloaded, local-only state', 1440, 1000, false);
await evaluate("document.querySelectorAll('.toast button').forEach((button) => button.click()); true");
await waitFor("document.querySelectorAll('.toast').length === 0", 'the cleared transient notification stack before the vocabulary fixture');

let fixtureClearVerified = false;
try {
  const fixtureUploaded = await evaluate(`(() => {
    const input = document.querySelector('#setting-private-vocabulary input[type="file"]');
    if (!(input instanceof HTMLInputElement)) return false;
    const payload = JSON.stringify({
      version: 1,
      replacements: {
        '__material_tools_capture_fixture_original__': '__material_tools_capture_fixture_replacement__'
      },
      required_phrases: {}
    });
    const transfer = new DataTransfer();
    transfer.items.add(new File([payload], 'capture-private-vocabulary.json', { type: 'application/json' }));
    Object.defineProperty(input, 'files', { configurable: true, value: transfer.files });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  if (!fixtureUploaded) throw new Error('The private-vocabulary file input was not available for the bounded capture fixture.');
  await waitFor(`(() => {
    const toast = [...document.querySelectorAll('.toast')]
      .find((item) => item.textContent?.includes('Private vocabulary loaded'));
    const illustration = toast?.querySelector('.action-illustration img');
    return toast?.textContent?.includes('Private vocabulary loaded')
      && illustration instanceof HTMLImageElement
      && illustration.complete
      && illustration.naturalWidth > 0;
  })()`, 'the private-vocabulary success notification and its action illustration');
  await capture('private-vocabulary-notification', 'Private-vocabulary success notification with its action illustration', 1440, 1000, false);

  const clearClicked = await evaluate(`(() => {
    document.querySelector('.toast button')?.click();
    const clear = [...document.querySelectorAll('#setting-private-vocabulary button')]
      .find((button) => button.textContent?.trim() === 'Clear local vocabulary');
    clear?.click();
    return Boolean(clear);
  })()`);
  if (!clearClicked) throw new Error('The bounded private-vocabulary fixture could not be cleared.');
  await waitFor(`(() => {
    const status = document.querySelector('#private-vocabulary-status');
    return status?.textContent?.includes('No private vocabulary is loaded')
      && localStorage.getItem('material-tools.private-vocabulary.v1') === null;
  })()`, 'the restored original wording after the bounded vocabulary fixture');
  fixtureClearVerified = true;
} finally {
  if (!fixtureClearVerified) {
    await evaluate("localStorage.removeItem('material-tools.private-vocabulary.v1'); true");
  }
}
await evaluate("document.querySelectorAll('.toast button').forEach((button) => button.click()); true");

await evaluate("document.querySelector('[aria-label=\"Open command palette\"]')?.click(); true");
await waitFor("Boolean(document.querySelector('.command-palette'))", 'the command palette');
await waitFor(`(() => {
  const palette = document.querySelector('.command-palette');
  const illustration = palette?.querySelector(':scope > .action-illustration--dialog');
  const search = palette?.querySelector(':scope > .search-composite');
  const results = palette?.querySelector(':scope > .command-results');
  if (!(palette && illustration && search && results)) return false;
  const paletteBox = palette.getBoundingClientRect();
  const illustrationBox = illustration.getBoundingClientRect();
  const searchBox = search.getBoundingClientRect();
  const resultsBox = results.getBoundingClientRect();
  return illustrationBox.bottom <= searchBox.top + 1
    && searchBox.bottom <= resultsBox.top + 1
    && illustrationBox.left >= paletteBox.left
    && illustrationBox.right <= paletteBox.right
    && searchBox.left >= paletteBox.left
    && searchBox.right <= paletteBox.right;
})()`, 'the non-overlapping command-palette illustration, search, and results layout');
await capture('command-palette', 'Command palette opened from the running application', 1440, 1000, false);

await evaluate("document.querySelector('.command-palette .regex-builder > summary')?.click(); true");
await waitFor("Boolean(document.querySelector('.command-palette details[open] .popover-surface'))", 'the regex builder');
await capture('regex-builder', 'Command-palette search with its anchored regular expression builder', 1440, 1000, false);

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
await evaluate(`(() => {
  window.scrollTo(0, 0);
  document.querySelector('main')?.scrollTo(0, 0);
  document.querySelector('.tab-rail')?.scrollTo(0, 0);
  return true;
})()`);
await waitFor("scrollY === 0 && (document.querySelector('main')?.scrollTop ?? 0) === 0", 'the narrow-layout scroll origin');
await capture('overview-narrow', 'Overview at a 390 by 844 narrow touch layout', 390, 844, false, true);

await clickTab('Install');
await waitFor("document.querySelectorAll('.application-card').length === 36", 'the narrow application catalog');
const narrowGeometry = await evaluate(`({
  bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  openRegexBuilders: document.querySelectorAll('.regex-builder[open]').length,
  shortTargets: [...document.querySelectorAll('button')]
    .filter((element) => element.getClientRects().length > 0 && element.getBoundingClientRect().height < 48)
    .map((element) => element.textContent?.trim() || element.getAttribute('aria-label')),
})`);
if (narrowGeometry.bodyOverflow) throw new Error('The narrow Install layout has sideways document overflow.');
if (narrowGeometry.openRegexBuilders !== 0) throw new Error('A regular-expression builder opened without user action in the narrow Install layout.');
if (narrowGeometry.shortTargets.length > 0) throw new Error(`The narrow Install layout has controls below 48px: ${narrowGeometry.shortTargets.join(', ')}`);
await capture('install-narrow', 'Install catalog at a 390 by 844 mobile touch layout', 390, 844, false, true);

await send('Emulation.clearDeviceMetricsOverride');
socket.close();

writeFileSync(resolve(outputDirectory, 'manifest.json'), `${JSON.stringify({
  schemaVersion: 1,
  product: 'Material Tools',
  commit,
  releaseTag,
  source: page.url,
  captureMethod: 'Locally built unsigned Squirrel.Windows package from the stated commit, hidden Win32 desktop, deterministic non-device-specific fixture, Chrome DevTools Protocol Page.captureScreenshot, and mobile touch emulation for 390 by 844 captures',
  privacyState: 'No user-supplied vocabulary was read. A bounded neutral in-memory document exercised the loaded notification, was cleared immediately, and left no cached value.',
  captures,
}, null, 2)}\n`);

console.log(`Wrote ${captures.length} captures and manifest.json to ${outputDirectory}`);
