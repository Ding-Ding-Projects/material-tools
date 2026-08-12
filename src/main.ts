import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from 'electron';
import squirrelStartup from 'electron-squirrel-startup';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import {
  IPC_CHANNELS,
  type ApplicationCapabilityRequest,
  type ApplicationCapabilitySnapshot,
  type ApplicationOperationCancelRequest,
  type ApplicationOperationExecuteRequest,
  type ApplicationOperationPreview,
  type ApplicationOperationPreviewRequest,
  type ApplicationOperationResult,
  type SystemSummary,
} from './shared/contracts';
import { createDocumentationCaptureSummary } from './shared/capture-fixture';
import { isTrustedRendererNavigation } from './shared/navigation';
import {
  createApplicationCapabilityFixture,
  readApplicationCapabilitySnapshot,
} from './main/application-capabilities';
import {
  ApplicationOperationCoordinator,
} from './main/application-operations';
import {
  canStartApplicationCapabilityScan,
  canStartApplicationOperationExecution,
  canStartApplicationOperationPreview,
  isAuthorizedIpcSender,
  isValidApplicationOperationAction,
  isValidApplicationOperationId,
  isValidApplicationPlanToken,
  isValidAppCapabilityOperationId,
  normalizeApplicationCapabilityKeys,
  normalizeApplicationOperationKeys,
  readAppCapabilityCancelOperationId,
} from './main/ipc-authorization';

const execFileAsync = promisify(execFile);
let mainWindow: BrowserWindow | null = null;
const activeAppCapabilityQueries = new Map<string, { controller: AbortController; senderId: number }>();
let applicationOperationPreviewActive = false;
const rendererPath = path.join(__dirname, '..', 'dist', 'renderer', 'index.html');
const rendererUrl = pathToFileURL(rendererPath).toString();
const appOperationCoordinator = new ApplicationOperationCoordinator({
  platform: process.platform,
  captureFixture: isDocumentationCaptureFixture(),
});

if (squirrelStartup) app.quit();

async function isElevated(): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  try {
    await execFileAsync('powershell.exe', [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '[Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent() | ForEach-Object { if ($_.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { exit 0 } else { exit 1 } }',
    ], { windowsHide: true, timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

async function getSystemSummary(): Promise<SystemSummary> {
  if (isDocumentationCaptureFixture()) {
    return createDocumentationCaptureSummary(app.getVersion());
  }
  const cpus = os.cpus();
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    architecture: os.arch(),
    cpuModel: cpus[0]?.model ?? 'Unknown processor',
    logicalProcessors: cpus.length,
    totalMemoryBytes: os.totalmem(),
    freeMemoryBytes: os.freemem(),
    uptimeSeconds: os.uptime(),
    appVersion: app.getVersion(),
    elevated: await isElevated(),
    captureFixture: false,
  };
}

function isDocumentationCaptureFixture(): boolean {
  return process.env.MATERIAL_TOOLS_CAPTURE_FIXTURE === '1'
    || process.argv.includes('--documentation-capture-fixture');
}

function isAuthorizedEvent(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  return isAuthorizedIpcSender({
    expectedWebContentsId: mainWindow?.webContents.id ?? null,
    senderWebContentsId: event.sender.id,
    senderFrameUrl: event.senderFrame?.url ?? '',
    rendererUrl,
  });
}

function readCapabilityRequest(value: unknown): ApplicationCapabilityRequest | null {
  if (!value || typeof value !== 'object') return null;
  const operationId = Reflect.get(value, 'operationId');
  const applicationKeys = normalizeApplicationCapabilityKeys(Reflect.get(value, 'applicationKeys'));
  return isValidAppCapabilityOperationId(operationId) && applicationKeys
    ? { operationId, applicationKeys }
    : null;
}

function readCapabilityCancelRequest(value: unknown): { operationId: string } | null {
  const operationId = readAppCapabilityCancelOperationId(value);
  return operationId ? { operationId } : null;
}

function readApplicationOperationPreviewRequest(value: unknown): ApplicationOperationPreviewRequest | null {
  if (!value || typeof value !== 'object') return null;
  const operationId = Reflect.get(value, 'operationId');
  const action = Reflect.get(value, 'action');
  const applicationKeys = normalizeApplicationOperationKeys(Reflect.get(value, 'applicationKeys'));
  return isValidApplicationOperationId(operationId)
    && isValidApplicationOperationAction(action)
    && applicationKeys
    ? { operationId, action, applicationKeys }
    : null;
}

function readApplicationOperationExecuteRequest(value: unknown): ApplicationOperationExecuteRequest | null {
  if (!value || typeof value !== 'object') return null;
  const operationId = Reflect.get(value, 'operationId');
  const planToken = Reflect.get(value, 'planToken');
  return isValidApplicationOperationId(operationId) && isValidApplicationPlanToken(planToken)
    ? { operationId, planToken }
    : null;
}

function readApplicationOperationCancelRequest(value: unknown): ApplicationOperationCancelRequest | null {
  if (!value || typeof value !== 'object') return null;
  const operationId = Reflect.get(value, 'operationId');
  return isValidApplicationOperationId(operationId) ? { operationId } : null;
}

function cancelledCapabilitySnapshot(operationId: string): ApplicationCapabilitySnapshot {
  return {
    operationId,
    state: 'cancelled',
    checkedAt: new Date().toISOString(),
    managers: [],
    applications: [],
  };
}

async function getAppCapabilities(
  event: IpcMainInvokeEvent,
  value: unknown,
): Promise<ApplicationCapabilitySnapshot> {
  if (!isAuthorizedEvent(event)) throw new Error('IPC request was rejected.');
  const request = readCapabilityRequest(value);
  if (!request) throw new Error('Application capability request was rejected.');
  if (!canStartApplicationCapabilityScan({
    activeCapabilityQueryCount: activeAppCapabilityQueries.size,
    applicationOperationPreviewActive,
    applicationOperationExecutionActive: appOperationCoordinator.hasActiveExecution(),
    applicationOperationPendingPlanActive: appOperationCoordinator.hasPendingPlan(),
  })) {
    throw new Error('Application capability scan cannot run during an application operation lifecycle.');
  }
  if (isDocumentationCaptureFixture()) {
    return createApplicationCapabilityFixture(request.operationId, request.applicationKeys);
  }

  const controller = new AbortController();
  activeAppCapabilityQueries.set(request.operationId, { controller, senderId: event.sender.id });
  try {
    return await readApplicationCapabilitySnapshot({
      operationId: request.operationId,
      applicationKeys: request.applicationKeys,
      platform: process.platform,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) return cancelledCapabilitySnapshot(request.operationId);
    throw error;
  } finally {
    activeAppCapabilityQueries.delete(request.operationId);
  }
}

function cancelAppCapabilities(event: IpcMainEvent, value: unknown): void {
  if (!isAuthorizedEvent(event)) return;
  const request = readCapabilityCancelRequest(value);
  if (!request) return;
  const active = activeAppCapabilityQueries.get(request.operationId);
  if (active?.senderId === event.sender.id) active.controller.abort();
}

async function previewApplicationOperation(
  event: IpcMainInvokeEvent,
  value: unknown,
): Promise<ApplicationOperationPreview> {
  if (!isAuthorizedEvent(event)) throw new Error('IPC request was rejected.');
  const request = readApplicationOperationPreviewRequest(value);
  if (!request) throw new Error('Application operation preview request was rejected.');
  if (!canStartApplicationOperationPreview({
    activeCapabilityQueryCount: activeAppCapabilityQueries.size,
    applicationOperationPreviewActive,
    applicationOperationExecutionActive: appOperationCoordinator.hasActiveExecution(),
    applicationOperationPendingPlanActive: appOperationCoordinator.hasPendingPlan(),
  })) {
    throw new Error('Application operation preview cannot run during a capability scan.');
  }
  applicationOperationPreviewActive = true;
  try {
    return await appOperationCoordinator.preview({
      senderId: event.sender.id,
      operationId: request.operationId,
      action: request.action,
      applicationKeys: request.applicationKeys,
    });
  } finally {
    applicationOperationPreviewActive = false;
  }
}

async function executeApplicationOperation(
  event: IpcMainInvokeEvent,
  value: unknown,
): Promise<ApplicationOperationResult> {
  if (!isAuthorizedEvent(event)) throw new Error('IPC request was rejected.');
  const request = readApplicationOperationExecuteRequest(value);
  if (!request) throw new Error('Application operation execution request was rejected.');
  if (!canStartApplicationOperationExecution({
    activeCapabilityQueryCount: activeAppCapabilityQueries.size,
    applicationOperationPreviewActive,
    applicationOperationExecutionActive: appOperationCoordinator.hasActiveExecution(),
    applicationOperationPendingPlanActive: appOperationCoordinator.hasPendingPlan(),
  })) {
    throw new Error('Application operation cannot run during a capability scan or preview.');
  }
  return appOperationCoordinator.execute({
    senderId: event.sender.id,
    operationId: request.operationId,
    planToken: request.planToken,
    onProgress: (progress) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.applicationOperationProgress, progress);
      }
    },
  });
}

function cancelApplicationOperation(event: IpcMainEvent, value: unknown): void {
  if (!isAuthorizedEvent(event)) return;
  const request = readApplicationOperationCancelRequest(value);
  if (!request) return;
  appOperationCoordinator.cancel(event.sender.id, request.operationId);
}

function abortAppCapabilityQueries(): void {
  for (const active of activeAppCapabilityQueries.values()) active.controller.abort();
  activeAppCapabilityQueries.clear();
}

function registerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.getSystemSummary, (event) => {
    if (!isAuthorizedEvent(event)) throw new Error('IPC request was rejected.');
    return getSystemSummary();
  });
  ipcMain.handle(IPC_CHANNELS.getAppCapabilities, getAppCapabilities);
  ipcMain.on(IPC_CHANNELS.cancelAppCapabilities, cancelAppCapabilities);
  ipcMain.handle(IPC_CHANNELS.previewApplicationOperation, previewApplicationOperation);
  ipcMain.handle(IPC_CHANNELS.executeApplicationOperation, executeApplicationOperation);
  ipcMain.on(IPC_CHANNELS.cancelApplicationOperation, cancelApplicationOperation);
  ipcMain.on(IPC_CHANNELS.minimizeWindow, (event) => {
    if (isAuthorizedEvent(event)) mainWindow?.minimize();
  });
  ipcMain.on(IPC_CHANNELS.toggleMaximizeWindow, (event) => {
    if (!isAuthorizedEvent(event)) return;
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on(IPC_CHANNELS.closeWindow, (event) => {
    if (isAuthorizedEvent(event)) mainWindow?.close();
  });
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 760,
    minHeight: 560,
    show: false,
    frame: false,
    backgroundColor: '#101418',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isTrustedRendererNavigation(targetUrl, rendererUrl)) event.preventDefault();
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    abortAppCapabilityQueries();
    appOperationCoordinator.abortAll();
    mainWindow = null;
  });

  void mainWindow.loadFile(rendererPath);
}

app.whenReady().then(() => {
  registerIpc();
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => app.quit());
