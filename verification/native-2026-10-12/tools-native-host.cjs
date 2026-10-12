'use strict';
// Task-only verifier. Loads the unchanged built coordinator, preload and renderer.
// This intentionally does not load production main.ts and is not installer acceptance.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const APP = path.resolve(process.env.TOOLS_VERIFY_APP);
const ROOT = path.resolve(process.env.TOOLS_VERIFY_ROOT);
const OUTPUT = path.resolve(__dirname, 'tools-native-results.json');
fs.mkdirSync(ROOT, { recursive: true });
const blocked = [], childProcessAttempts = [], fakeCalls = [], progress = [], results = [], previews = [], tests = [], captures = [];
const deny = kind => { blocked.push(kind); throw new Error('Verification blocked ' + kind); };
for (const name of ['execFile', 'exec', 'spawn', 'fork', 'execFileSync', 'execSync', 'spawnSync']) {
  require('node:child_process')[name] = () => { childProcessAttempts.push(name); throw new Error('Real subprocesses forbidden'); };
}
require('node:net').Socket.prototype.connect = () => deny('tcp');
for (const name of ['node:http', 'node:https']) {
  const m = require(name); m.request = () => deny(name); m.get = () => deny(name);
}
require('node:tls').connect = () => deny('tls');
require('node:dgram').createSocket = () => deny('udp');
global.fetch = async () => deny('fetch');
const { app, BrowserWindow, ipcMain, session, net, shell, utilityProcess } = require('electron');
net.request = () => deny('electron-net'); net.fetch = async () => deny('electron-fetch');
shell.openExternal = async () => deny('external-link'); shell.openPath = async () => deny('external-path');
utilityProcess.fork = () => deny('utility-process');
app.disableHardwareAcceleration();
app.setPath('userData', path.join(ROOT, 'chromium-profile'));
app.setPath('temp', ROOT); app.setPath('logs', path.join(ROOT, 'logs'));
const { ApplicationOperationCoordinator } = require(path.join(APP, 'dist-electron/main/application-operations.js'));
const { readApplicationCapabilitySnapshot } = require(path.join(APP, 'dist-electron/main/application-capabilities.js'));
const { IPC_CHANNELS: C } = require(path.join(APP, 'dist-electron/shared/contracts.js'));
const A = require(path.join(APP, 'dist-electron/main/ipc-authorization.js'));
const { createDocumentationCaptureSummary } = require(path.join(APP, 'dist-electron/shared/capture-fixture.js'));
const { APPLICATION_CATALOG } = require(path.join(APP, 'dist-electron/shared/application-catalog.generated.js'));
const knownChoco = new Set(APPLICATION_CATALOG.flatMap(x => x.choco));
const rendererPath = path.join(APP, 'dist/renderer/index.html');
const rendererUrl = pathToFileURL(rendererPath).toString();
let win, mode = 'normal', installed = new Set(['git']), chocoVersion = '2.4.3', deliveryFailures = 0;
let previewActive = false, capabilityActive = 0, executeInvocations = 0, previewInvocations = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function abortableDelay(ms, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(Object.assign(new Error('Synthetic cancellation'), { name: 'AbortError' })); };
    const timer = setTimeout(resolve, ms);
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
  });
}
async function fakeRunner(executable, args, options) {
  fakeCalls.push({ mode, executable, args: [...args], activeExecution: coordinator.hasActiveExecution() });
  if (options.signal?.aborted) throw Object.assign(new Error('Synthetic cancellation'), { name: 'AbortError' });
  if (args.length === 1 && args[0] === '--version') {
    if (executable === 'winget.exe') throw Object.assign(new Error('Synthetic missing manager'), { code: 'ENOENT' });
    assert.equal(executable, 'choco.exe'); return { stdout: chocoVersion, stderr: '' };
  }
  assert.equal(executable, 'choco.exe');
  assert(knownChoco.has(args[1]), 'Unexpected non-catalog package argument');
  if (args[0] === 'list') {
    assert.deepEqual(args.slice(2), ['--exact', '--limit-output', '--no-progress', '--no-color']);
    if (mode === 'cancel-preflight' && coordinator.hasActiveExecution()) await abortableDelay(2000, options.signal);
    return { stdout: installed.has(args[1]) ? args[1] + '|1.0.0\n' : '', stderr: '' };
  }
  assert.equal(args[0], 'upgrade', 'Only a synthetic upgrade is allowed');
  assert.deepEqual(args.slice(2), ['--yes', '--no-progress', '--limit-output', '--no-color', '--fail-on-not-installed']);
  assert(installed.has(args[1]), 'Fake mutation must never install an absent package');
  await abortableDelay(450, options.signal);
  if (mode === 'mutation-fail') throw Object.assign(new Error('SYNTHETIC_PRIVATE_OUTPUT_MUST_NOT_LEAK'), { stdout: 'SYNTHETIC_PRIVATE_OUTPUT_MUST_NOT_LEAK' });
  return { stdout: 'Synthetic success; nothing executed', stderr: '' };
}
const coordinator = new ApplicationOperationCoordinator({ platform: process.platform, runner: fakeRunner });
const lifecycle = () => ({ activeCapabilityQueryCount: capabilityActive, applicationOperationPreviewActive: previewActive,
  applicationOperationExecutionActive: coordinator.hasActiveExecution(), applicationOperationPendingPlanActive: coordinator.hasPendingPlan() });
function authorize(event) {
  assert(A.isAuthorizedIpcSender({ expectedWebContentsId: win?.webContents.id ?? null, senderWebContentsId: event.sender.id,
    senderFrameUrl: event.senderFrame?.url ?? '', rendererUrl }), 'Unauthorized verification IPC sender');
}
function register() {
  ipcMain.handle(C.getSystemSummary, event => { authorize(event); return createDocumentationCaptureSummary('0.1.0-native-verification'); });
  ipcMain.handle(C.getAppCapabilities, async (event, request) => {
    authorize(event); assert(A.isValidAppCapabilityOperationId(request.operationId));
    const keys = A.normalizeApplicationCapabilityKeys(request.applicationKeys); assert(keys);
    assert(A.canStartApplicationCapabilityScan(lifecycle()), 'Capability scan blocked during application lifecycle');
    capabilityActive++;
    try { return await readApplicationCapabilitySnapshot({ operationId: request.operationId, applicationKeys: keys, platform: process.platform, runner: fakeRunner }); }
    finally { capabilityActive--; }
  });
  ipcMain.handle(C.previewApplicationOperation, async (event, request) => {
    authorize(event); assert(A.isValidApplicationOperationId(request.operationId)); assert(A.isValidApplicationOperationAction(request.action));
    const keys = A.normalizeApplicationOperationKeys(request.applicationKeys); assert(keys, 'Unlisted catalog key rejected');
    assert(A.canStartApplicationOperationPreview(lifecycle()), 'Preview lifecycle rejected'); previewActive = true; previewInvocations++;
    try {
      const preview = await coordinator.preview({ senderId: event.sender.id, ...request, applicationKeys: keys }); previews.push(preview); return preview;
    } finally { previewActive = false; }
  });
  ipcMain.handle(C.executeApplicationOperation, async (event, request) => {
    authorize(event); assert(A.isValidApplicationOperationId(request.operationId)); assert(A.isValidApplicationPlanToken(request.planToken));
    assert(A.canStartApplicationOperationExecution(lifecycle()), 'Execution lifecycle rejected'); executeInvocations++;
    const result = await coordinator.execute({ senderId: event.sender.id, ...request, onProgress(value) {
      progress.push(value);
      if (mode === 'throw-progress') { deliveryFailures++; throw new Error('Synthetic progress delivery failure'); }
      event.sender.send(C.applicationOperationProgress, value);
    } });
    results.push(result); return result;
  });
  ipcMain.on(C.cancelApplicationOperation, (event, request) => {
    authorize(event); assert(A.isValidApplicationOperationId(request.operationId)); coordinator.cancel(event.sender.id, request.operationId);
  });
  for (const channel of [C.minimizeWindow, C.toggleMaximizeWindow, C.closeWindow, C.cancelAppCapabilities]) ipcMain.on(channel, event => authorize(event));
}
const ui = async source => {
  try { return await win.webContents.executeJavaScript(source, true); }
  catch (e) { throw new Error(e.message + '\nDriver expression: ' + source); }
};
async function waitFor(expression, label) {
  const start = Date.now();
  while (Date.now() - start < 8000) { if (await ui(expression)) return; await sleep(75); }
  throw new Error('Driver timed out: ' + label + '\n' + await ui('document.body.innerText.slice(-7000)'));
}
async function click(selector, text, twice = false) {
  assert(await ui(`(() => {const b=[...document.querySelectorAll(${JSON.stringify(selector)})].find(x=>x.textContent.trim()===${JSON.stringify(text)}); if(!b || b.disabled) return false; b.click(); ${twice ? 'b.click();' : ''} return true;})()`), 'Driver click target missing/enabled: ' + text);
}
async function capture(name, selector = '.operation-workspace') {
  await ui(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'start'}); true`);
  await sleep(180); assert(!win.isVisible()); assert(win.webContents.isOffscreen());
  const image = await win.webContents.capturePage(); assert(!image.isEmpty());
  const file = path.join(__dirname, 'tools-native-' + name + '.png'); fs.writeFileSync(file, image.toPNG());
  captures.push({ name, file, size: image.getSize(), hidden: !win.isVisible(), offscreen: true });
}
async function reset(nextMode = 'normal') {
  if (coordinator.hasLifecycle()) {
    const last = previews.at(-1); await ui(`window.materialTools.cancelApplicationOperation(${JSON.stringify(last.operationId)}); true`);
    for(let i=0; i<30 && coordinator.hasLifecycle(); i++) await sleep(30);
  }
  assert(!coordinator.hasLifecycle(), 'Prior operation was not cleaned up');
  mode = nextMode; installed = new Set(['git']); chocoVersion = '2.4.3';
  await win.loadFile(rendererPath); await waitFor("Boolean(document.querySelector('.app-shell'))", 'app shell');
  await click('[role="tab"]', 'Install');
  await waitFor("Boolean(document.querySelector('.catalog-search input'))", 'catalog search');
  await ui(`(() => {const i=document.querySelector('.catalog-search input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'Git'); i.dispatchEvent(new Event('input',{bubbles:true})); return true;})()`);
  await waitFor("[...document.querySelectorAll('.application-card h3')].some(x=>x.textContent==='Git')", 'Git card');
  assert(await ui("(() => {const c=[...document.querySelectorAll('.application-card')].find(x=>x.querySelector('h3')?.textContent==='Git'); const b=c?.querySelector('button'); b?.click(); return !!b;})()"));
  await waitFor("document.querySelector('#review-plan-title')?.textContent.includes('1 applications')", 'one selected app');
  await click('.operation-action-row [role="radio"]', 'Upgrade');
  await waitFor("[...document.querySelectorAll('.operation-action-row button')].some(x=>x.textContent==='Preview upgrade for 1')", 'Upgrade action');
}
async function preview() {
  await click('.operation-action-row button', 'Preview upgrade for 1');
  await waitFor("Boolean(document.querySelector('.operation-preview'))", 'preview');
  return previews.at(-1);
}
async function finish() {
  await waitFor("Boolean(document.querySelector('.operation-result'))", 'result');
  assert(!coordinator.hasLifecycle()); return results.at(-1);
}
function passed(name, evidence) { tests.push({ name, status: 'passed', ...evidence }); process.stdout.write('PASS ' + name + '\n'); }
async function run() {
  assert.equal(process.platform, 'win32');
  await reset(); let start = fakeCalls.length, executions = executeInvocations;
  const first = await preview(); assert.equal(first.state, 'ready');
  assert.equal(fakeCalls.slice(start).filter(x => x.args[0] === 'upgrade').length, 0);
  await capture('ready-preview');
  await click('.operation-preview button', 'Confirm and upgrade 1 ready application', true);
  await waitFor("Boolean(document.querySelector('.operation-progress'))", 'progress');
  await capture('progress', '.operation-progress');
  let result = await finish(); assert.equal(result.state, 'completed');
  assert.equal(executeInvocations - executions, 1);
  const upgradeCalls = fakeCalls.slice(start).filter(x => x.args[0] === 'upgrade'); assert.equal(upgradeCalls.length, 1);
  await capture('success', '.operation-result');
  const replay = await ui(`window.materialTools.executeApplicationOperation(${JSON.stringify(first.operationId)}, ${JSON.stringify(first.planToken)}).then(()=>({rejected:false}),e=>({rejected:true,message:e.message}))`);
  assert(replay.rejected);
  passed('native UI preview, repeated confirmation, successful guarded upgrade and consumed token', { executeInvocations: 1, fakeUpgradeCalls: upgradeCalls, result, replay });

  await reset('throw-progress'); start = fakeCalls.length; const beforeDelivery = deliveryFailures;
  await preview(); await click('.operation-preview button', 'Confirm and upgrade 1 ready application'); result = await finish();
  assert.equal(result.state, 'completed'); assert.equal(result.items.length, 1); assert(deliveryFailures - beforeDelivery >= 3);
  await capture('progress-delivery-failure', '.operation-result');
  passed('throwing native progress delivery retains one terminal result and clears lifecycle', { deliveryFailures: deliveryFailures - beforeDelivery, result, lifecycle: lifecycle() });

  await reset('cancel-preflight'); start = fakeCalls.length; await preview();
  await click('.operation-preview button', 'Confirm and upgrade 1 ready application');
  await waitFor("[...document.querySelectorAll('.operation-progress button')].some(x=>x.textContent==='Cancel operation')", 'cancel action');
  await click('.operation-progress button', 'Cancel operation', true); result = await finish();
  assert.equal(result.state, 'cancelled'); assert.equal(result.items[0].state, 'cancelled');
  assert.equal(fakeCalls.slice(start).filter(x=>x.args[0]==='upgrade').length, 0);
  await capture('cancelled', '.operation-result'); passed('native UI repeated cancellation during preflight prevents fake mutation', { result, lifecycle: lifecycle() });

  await reset(); installed.clear(); start = fakeCalls.length; const missing = await preview();
  assert.equal(missing.state, 'unavailable'); assert(await ui("document.querySelector('.operation-preview button').disabled"));
  assert.equal(fakeCalls.slice(start).filter(x=>x.args[0]==='upgrade').length, 0);
  const blockedScan = await ui("window.materialTools.getAppCapabilities(['git']).then(()=>({rejected:false}),e=>({rejected:true,message:e.message}))");
  assert(blockedScan.rejected); await capture('not-installed');
  passed('native UI absent package fails closed with disabled confirmation', { preview: missing, blockedScan, pendingPlanRemains: coordinator.hasPendingPlan(), existingLimitation: 'Unavailable previews lack a visible discard button; pending plan blocks scans until replaced or cancelled through bridge.' });

  await reset(); await preview(); installed.clear(); start = fakeCalls.length;
  await click('.operation-preview button', 'Confirm and upgrade 1 ready application'); result = await finish();
  assert.equal(result.items[0].state, 'unavailable'); assert.equal(fakeCalls.slice(start).filter(x=>x.args[0]==='upgrade').length, 0);
  await capture('removed-after-preview', '.operation-result');
  passed('native execution preflight refuses package removed after preview', { result });

  await reset(); chocoVersion = '1.4.0'; start = fakeCalls.length; const old = await preview();
  assert.equal(old.state, 'unavailable'); assert.equal(fakeCalls.slice(start).filter(x=>x.args[0]!=='--version').length, 0);
  assert(await ui("document.querySelector('.operation-preview button').disabled"));
  await capture('old-chocolatey'); passed('native UI rejects Chocolatey v1 before installed-state query', { preview: old });

  await reset('mutation-fail'); await preview(); await click('.operation-preview button', 'Confirm and upgrade 1 ready application'); result = await finish();
  assert.equal(result.state, 'failed'); assert.equal(result.items.length, 1);
  assert(!(await ui('document.body.innerText')).includes('SYNTHETIC_PRIVATE_OUTPUT_MUST_NOT_LEAK'));
  await capture('failed', '.operation-result'); passed('native UI fake command failure remains failure without raw output disclosure', { result, lifecycle: lifecycle() });

  start = fakeCalls.length;
  const unknown = await ui("window.materialTools.previewApplicationOperation('upgrade',['not-a-catalog-key']).then(()=>({rejected:false}),e=>({rejected:true,message:e.message}))");
  assert(unknown.rejected); assert.equal(fakeCalls.length, start); passed('unknown renderer catalog key rejected before fake runner', { unknown });
  assert.equal(childProcessAttempts.length, 0); assert.equal(blocked.length, 0); assert(!win.isVisible());
}
function report(error) {
  fs.writeFileSync(OUTPUT, JSON.stringify({ commit: '4fbfebb6daf29450eff7b032179198d8d0eba55b', app: APP,
    asarSha256: require('node:crypto').createHash('sha256').update(require('original-fs').readFileSync(APP)).digest('hex'), status: error ? 'failed' : 'passed',
    runtime: { electron: process.versions.electron, node: process.versions.node, platform: process.platform, arch: process.arch },
    route: 'Task-only typed IPC host, unchanged compiled coordinator with fake CommandRunner, unchanged bundled preload and built renderer; production main.ts not loaded.',
    acceptanceLimits: ['Synthetic in-memory package state only', 'No real package manager or application mutation', 'Production main-process startup and installer acceptance untested'],
    hidden: win ? !win.isVisible() : null, offscreen: win?.webContents.isOffscreen(), tests, captures, childProcessAttempts, networkAndExternalAttempts: blocked,
    fakeCalls, progress, previews, results, executeInvocations, previewInvocations, error: error?.stack }, null, 2));
}
app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*','https://*/*','ws://*/*','wss://*/*'] }, (_details, cb) => { blocked.push('renderer-request'); cb({cancel:true}); });
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, cb) => cb(false));
  register();
  win = new BrowserWindow({ width: 1440, height: 1100, show: false, frame: false, webPreferences: {
    preload: path.join(APP, 'dist-electron/preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true,
    webSecurity: true, offscreen: true, spellcheck: false, backgroundThrottling: false } });
  win.show = () => { throw new Error('Visible window forbidden'); };
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => { if(url !== rendererUrl) e.preventDefault(); });
  await run(); report(); process.stdout.write('Native verification complete: ' + OUTPUT + '\n'); app.exit(0);
}).catch(async error => {
  process.stderr.write(error.stack + '\n');
  try { if(win) await capture('driver-error', 'body'); } catch {}
  report(error); app.exit(1);
});
process.on('unhandledRejection', error => { process.stderr.write('Unhandled: ' + String(error?.stack || error) + '\n'); });
