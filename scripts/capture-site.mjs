import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { selectSoleCdpPage } from './cdp-target.mjs';

function option(name, fallback) {
  const prefix = `--${name}=`;
  const entry = process.argv.slice(2).find((argument) => argument.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : fallback;
}

function describeCaptureMethod(source) {
  const sourceUrl = new URL(source);
  if (sourceUrl.protocol === 'https:'
    && sourceUrl.hostname.toLowerCase() === 'ding-ding-projects.github.io'
    && sourceUrl.pathname === '/material-tools/') {
    return 'Live GitHub Pages deployment opened in Microsoft Edge on a hidden Win32 desktop with a fresh profile; Chrome DevTools Protocol Page.captureScreenshot';
  }
  if (['127.0.0.1', 'localhost', '[::1]'].includes(sourceUrl.hostname.toLowerCase())) {
    return 'Local documentation preview opened in Microsoft Edge on a hidden Win32 desktop with a fresh profile; Chrome DevTools Protocol Page.captureScreenshot';
  }
  return 'Documentation target opened in Microsoft Edge on a hidden Win32 desktop with a fresh profile; Chrome DevTools Protocol Page.captureScreenshot';
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
const page = selectSoleCdpPage(targets, expectedOrigin, port);

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

async function closeSocket() {
  if (socket.readyState === WebSocket.CLOSED) return true;
  const closed = new Promise((resolveClose) => {
    const timer = setTimeout(() => resolveClose(false), 1_500);
    socket.addEventListener('close', () => {
      clearTimeout(timer);
      resolveClose(true);
    }, { once: true });
  });
  socket.close(1000, 'Capture complete');
  return closed;
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

async function assertMobileOverviewGeometry(label, expectCompactProof) {
  const evidence = await evaluate(`(() => {
    const action = document.querySelector('.installer-download');
    const spans = [...(action?.querySelectorAll(':scope > span') ?? [])];
    const compactProof = document.querySelector('.release-proof--compact');
    const wideProof = document.querySelector('.hero-card p.release-proof:not(.release-proof--compact)');
    const proof = ${expectCompactProof ? 'compactProof' : 'wideProof'};
    const proofControl = ${expectCompactProof ? "compactProof?.querySelector(':scope > summary')" : 'wideProof'};
    if (!(action instanceof HTMLElement) || spans.length !== 3 || !(proof instanceof HTMLElement) || !(proofControl instanceof HTMLElement)) {
      return { ok: false, reason: 'required controls missing', spanCount: spans.length, compactProof: Boolean(compactProof), wideProof: Boolean(wideProof) };
    }
    const actionStyle = getComputedStyle(action);
    const actionBounds = action.getBoundingClientRect();
    const spanBounds = spans.map((span) => span.getBoundingClientRect());
    const proofStyle = getComputedStyle(proofControl);
    const proofBounds = proofControl.getBoundingClientRect();
    const scrollContainer = document.querySelector('main');
    const separated = spanBounds.slice(1).every((bounds, index) => {
      const previous = spanBounds[index];
      const sameLine = Math.abs(bounds.top - previous.top) <= 2;
      return sameLine ? bounds.left - previous.right >= 0.5 : bounds.top >= previous.bottom - 1;
    });
    const labelText = spans.map((span) => span.textContent?.trim() ?? '').join(' ');
    const proofReachable = proofBounds.left >= -1
      && proofBounds.right <= innerWidth + 1
      && proofBounds.height >= 48
      && proofBounds.bottom + (scrollContainer?.scrollTop ?? scrollY) <= (scrollContainer?.scrollHeight ?? document.documentElement.scrollHeight) + 56;
    const ok = labelText === 'Download 0.1.0 for Windows (x64)'
      && Number.parseFloat(actionStyle.columnGap) > 0
      && actionBounds.left >= -1
      && actionBounds.right <= innerWidth + 1
      && actionBounds.height >= 48
      && spanBounds.every((bounds) => bounds.width > 0 && bounds.height > 0)
      && separated
      && proofStyle.display !== 'none'
      && proofStyle.visibility === 'visible'
      && Number(proofStyle.opacity) > 0
      && proofReachable;
    return {
      ok,
      labelText,
      columnGap: actionStyle.columnGap,
      action: { left: actionBounds.left, right: actionBounds.right, height: actionBounds.height },
      spans: spanBounds.map((bounds) => ({ left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom })),
      separated,
      proof: { left: proofBounds.left, right: proofBounds.right, top: proofBounds.top, bottom: proofBounds.bottom, height: proofBounds.height },
      proofReachable,
    };
  })()`);
  if (!evidence?.ok) throw new Error(`${label} failed responsive geometry checks: ${JSON.stringify(evidence)}`);
}

const captures = [];
async function capture(name, state, width = 1440, height = 1000, captureBeyondViewport = true, mobile = false, touch = false) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    screenWidth: width,
    screenHeight: height,
    deviceScaleFactor: 1,
    mobile,
    screenOrientation: width > height
      ? { type: 'landscapePrimary', angle: 90 }
      : { type: 'portraitPrimary', angle: 0 },
  });
  await send('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: touch ? 5 : 1 });
  await waitFor("document.fonts.status === 'loaded'", 'document fonts');
  if (mobile) {
    await waitFor(`document.documentElement.scrollWidth <= innerWidth + 1
      && document.body.scrollWidth <= innerWidth + 1`, `${width} by ${height} mobile content without sideways overflow`);
  }
  await waitFor(`(() => {
    const images = [...document.images];
    images.forEach((image) => { image.loading = 'eager'; });
    return images.every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
  })()`, `${name} image readiness`);
  if (mobile && ['overview-narrow', 'overview-release-proof-mobile', 'overview-compact', 'overview-landscape'].includes(name)) {
    const expectsCompactProof = width <= 760 || (height <= 500 && width <= 900);
    const proofSelector = expectsCompactProof ? '.release-proof--compact > summary' : '.hero-card p.release-proof:not(.release-proof--compact)';
    await waitFor(`Boolean(document.querySelector('.installer-download'))
      && document.querySelectorAll('.installer-download > span').length === 3
      && Boolean(document.querySelector(${JSON.stringify(proofSelector)}))`, `${name} responsive installer proof`);
    await assertMobileOverviewGeometry(`${name} at ${width} by ${height}`, expectsCompactProof);
  }
  await delay(260);
  const result = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport });
  const bytes = Buffer.from(result.data, 'base64');
  if (bytes.length < 24 || bytes.toString('ascii', 1, 4) !== 'PNG') throw new Error(`Capture is not a valid PNG: ${name}`);
  const capturedWidth = bytes.readUInt32BE(16);
  const capturedHeight = bytes.readUInt32BE(20);
  writeFileSync(resolve(outputDirectory, `${name}.png`), bytes);
  captures.push({ file: `${name}.png`, state, width: capturedWidth, height: capturedHeight, bytes: bytes.length, mobile, touch });
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
await waitFor("scrollY === 0 && (document.querySelector('main')?.scrollTop ?? 0) === 0", 'the overview scroll origin');
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

await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  screenWidth: 390,
  screenHeight: 844,
  deviceScaleFactor: 1,
  mobile: true,
  screenOrientation: { type: 'portraitPrimary', angle: 0 },
});
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
const mobileReloadOrigin = await evaluate('performance.timeOrigin');
await send('Page.reload', { ignoreCache: true });
await waitFor(`performance.timeOrigin > ${JSON.stringify(mobileReloadOrigin)}`, 'the new mobile document');
await waitFor(`document.readyState === 'complete'
  && Boolean(document.querySelector('.app-shell'))
  && Boolean(document.querySelector('#tab-overview'))
  && Boolean(document.querySelector('#panel-overview'))`, 'the reloaded mobile application shell');
await waitFor("scrollY === 0 && (document.querySelector('main')?.scrollTop ?? 0) === 0", 'the mobile overview scroll origin');
await capture('overview-narrow', 'Live documentation home at a 390 by 844 mobile touch layout', 390, 844, false, true, true);
await evaluate("document.querySelector('.release-proof--compact')?.scrollIntoView({ block: 'center' }); true");
await click('.release-proof--compact > summary', 'Compact verified-installer details');
await waitFor(`(() => {
  const details = document.querySelector('.release-proof--compact');
  const summary = details?.querySelector(':scope > summary');
  const body = details?.querySelector(':scope > p');
  if (!(details instanceof HTMLDetailsElement) || !(summary instanceof HTMLElement) || !(body instanceof HTMLElement)) return false;
  const summaryBounds = summary.getBoundingClientRect();
  const bodyBounds = body.getBoundingClientRect();
  return details.open
    && summaryBounds.left >= -1
    && summaryBounds.right <= innerWidth + 1
    && summaryBounds.top >= -1
    && bodyBounds.left >= -1
    && bodyBounds.right <= innerWidth + 1
    && bodyBounds.bottom <= innerHeight + 1;
})()`, 'the opened in-viewport verified-installer details');
await capture('overview-release-proof-mobile', 'Live verified unsigned-installer details opened at a 390 by 844 mobile touch layout', 390, 844, false, true, true);
await click('.release-proof--compact > summary', 'Compact verified-installer details');
await evaluate("document.querySelector('main')?.scrollTo({ top: 0 }); window.scrollTo({ top: 0 }); true");
await waitFor("scrollY === 0 && (document.querySelector('main')?.scrollTop ?? 0) === 0", 'the restored mobile overview scroll origin');
await click('.private-vocabulary-quick__trigger', 'Mobile private-vocabulary panel trigger');
await waitFor(`(() => {
  const panel = document.querySelector('#private-vocabulary-quick-panel');
  const scrim = document.querySelector('.private-vocabulary-quick__scrim');
  const upload = panel?.querySelector('.private-vocabulary-quick__upload');
  const fileInput = upload?.querySelector('input[type="file"]');
  const close = panel?.querySelector('header button');
  const status = panel?.querySelector('.private-vocabulary-control__status');
  const clear = panel?.querySelector('button[disabled]');
  if (!(panel instanceof HTMLElement) || !(scrim instanceof HTMLElement)) return false;
  if (!(upload instanceof HTMLElement) || !(fileInput instanceof HTMLInputElement) || !(close instanceof HTMLElement) || !(status instanceof HTMLElement) || !(clear instanceof HTMLElement)) return false;
  const panelStyle = getComputedStyle(panel);
  const scrimStyle = getComputedStyle(scrim);
  const bounds = panel.getBoundingClientRect();
  const scrimBounds = scrim.getBoundingClientRect();
  const requiredControls = [upload, close, status, clear];
  const controlsFit = requiredControls.every((control) => {
    const controlStyle = getComputedStyle(control);
    const controlBounds = control.getBoundingClientRect();
    return controlStyle.display !== 'none'
      && controlStyle.visibility === 'visible'
      && Number(controlStyle.opacity) > 0
      && controlBounds.left >= bounds.left - 1
      && controlBounds.top >= bounds.top - 1
      && controlBounds.right <= bounds.right + 1
      && controlBounds.bottom <= bounds.bottom + 1;
  });
  return panel.getAttribute('role') === 'dialog'
    && panel.getAttribute('aria-modal') === 'true'
    && panelStyle.position === 'fixed'
    && panelStyle.visibility === 'visible'
    && panelStyle.display !== 'none'
    && Number(panelStyle.opacity) > 0
    && scrimStyle.visibility === 'visible'
    && scrimStyle.display !== 'none'
    && Math.abs(bounds.left) <= 1
    && bounds.top >= -1
    && Math.abs(bounds.right - innerWidth) <= 1
    && Math.abs(bounds.bottom - innerHeight) <= 1
    && bounds.width >= innerWidth - 1
    && bounds.height >= 260
    && scrimBounds.left >= -1
    && scrimBounds.top >= -1
    && scrimBounds.right <= innerWidth + 1
    && scrimBounds.bottom <= innerHeight + 1
    && scrimBounds.width >= innerWidth - 1
    && scrimBounds.height >= innerHeight - 1
    && controlsFit;
})()`, 'the fully visible in-viewport mobile private-vocabulary panel');
await delay(180);
await capture('private-vocabulary-mobile', 'Live M3 private-vocabulary bottom sheet at a 390 by 844 mobile touch layout', 390, 844, false, true, true);
await click('#private-vocabulary-quick-panel > header button', 'Mobile private-vocabulary panel close control');
await waitFor(`(() => {
  const trigger = document.querySelector('.private-vocabulary-quick__trigger');
  return !document.querySelector('#private-vocabulary-quick-panel')
    && !document.querySelector('.private-vocabulary-quick__scrim')
    && trigger instanceof HTMLElement
    && trigger.getAttribute('aria-expanded') === 'false'
    && document.activeElement === trigger;
})()`, 'the closed private-vocabulary panel');
await click('[aria-label="Open navigation"]', 'Mobile navigation drawer trigger');
await waitFor(`(() => {
  const navigation = document.querySelector('#feature-navigation');
  if (!(navigation instanceof HTMLElement) || !navigation.classList.contains('is-mobile-open')) return false;
  const style = getComputedStyle(navigation);
  const bounds = navigation.getBoundingClientRect();
  return style.visibility === 'visible' && Math.abs(bounds.left) < 1 && bounds.width >= 250;
})()`, 'the fully opened mobile navigation drawer');
await delay(180);
await capture('mobile-navigation', 'Live M3 mobile navigation drawer with touch emulation', 390, 844, false, true, true);
await click('[aria-label="Close navigation"]', 'Mobile navigation drawer close control');
await waitFor(`(() => {
  const navigation = document.querySelector('#feature-navigation');
  if (!(navigation instanceof HTMLElement) || navigation.classList.contains('is-mobile-open')) return false;
  const style = getComputedStyle(navigation);
  const bounds = navigation.getBoundingClientRect();
  return style.visibility === 'hidden' && bounds.right <= 1;
})()`, 'the fully closed mobile navigation drawer');
await capture('overview-compact', 'Live documentation home at the minimum 320 by 568 mobile touch layout', 320, 568, false, true, true);
await capture('overview-landscape', 'Live documentation home at an 844 by 390 landscape mobile touch layout', 844, 390, false, true, true);

await send('Emulation.setTouchEmulationEnabled', { enabled: false, maxTouchPoints: 1 });
await send('Emulation.clearDeviceMetricsOverride');

writeFileSync(resolve(outputDirectory, 'manifest.json'), `${JSON.stringify({
  schemaVersion: 1,
  product: 'Material Tools documentation',
  deployedCommit: commit,
  pagesRun,
  source: page.url,
  captureMethod: describeCaptureMethod(page.url),
  privacyState: 'No private vocabulary file was supplied; original wording remained active.',
  captures,
}, null, 2)}\n`);

console.log(`Wrote ${captures.length} live-site captures and manifest.json to ${outputDirectory}`);
const socketClosed = await closeSocket();
if (!socketClosed) {
  console.warn('CDP WebSocket did not finish its close handshake; capture files are complete, so the bounded harness is exiting.');
  await new Promise((resolveFlush) => process.stdout.write('', resolveFlush));
  process.exit(0);
}
