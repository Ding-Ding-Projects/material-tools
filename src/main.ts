import { app, BrowserWindow, ipcMain, shell } from 'electron';
import squirrelStartup from 'electron-squirrel-startup';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { IPC_CHANNELS, type SystemSummary } from './shared/contracts';
import { createDocumentationCaptureSummary } from './shared/capture-fixture';
import { isTrustedRendererNavigation } from './shared/navigation';

const execFileAsync = promisify(execFile);
let mainWindow: BrowserWindow | null = null;

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
  if (process.env.MATERIAL_TOOLS_CAPTURE_FIXTURE === '1' || process.argv.includes('--documentation-capture-fixture')) {
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

function registerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.getSystemSummary, getSystemSummary);
  ipcMain.on(IPC_CHANNELS.minimizeWindow, () => mainWindow?.minimize());
  ipcMain.on(IPC_CHANNELS.toggleMaximizeWindow, () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on(IPC_CHANNELS.closeWindow, () => mainWindow?.close());
}

function createMainWindow(): void {
  const rendererPath = path.join(__dirname, '..', 'dist', 'renderer', 'index.html');
  const rendererUrl = pathToFileURL(rendererPath).toString();
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
  mainWindow.on('closed', () => { mainWindow = null; });

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
