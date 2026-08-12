#!/usr/bin/env node

// npm can leave the Electron package metadata present while omitting the
// platform binary. Electron's asynchronous installer can also exit zero before
// extraction settles on some Node versions. This helper judges success only by
// the verified executable existing, and restores it synchronously when needed.

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronDirectory = path.join(root, 'node_modules', 'electron');
const distDirectory = path.join(electronDirectory, 'dist');

function fail(message) {
  process.stderr.write(`ensure-electron-binary: ${message}\n`);
  process.exit(1);
}

function executableRelativePath() {
  if (process.platform === 'win32') return 'electron.exe';
  if (process.platform === 'darwin') return 'Electron.app/Contents/MacOS/Electron';
  if (['linux', 'freebsd', 'openbsd'].includes(process.platform)) return 'electron';
  throw new Error(`Electron builds are not available for ${process.platform}.`);
}

function binaryPresent(relativePath) {
  return fs.existsSync(path.join(distDirectory, relativePath));
}

function writePathFile(relativePath) {
  fs.writeFileSync(path.join(electronDirectory, 'path.txt'), relativePath, 'utf8');
}

function electronVersion() {
  const manifestPath = path.join(electronDirectory, 'package.json');
  if (!fs.existsSync(manifestPath)) fail(`electron is not installed; ${manifestPath} is missing. Run npm ci first.`);
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')).version;
}

function expectedChecksum(assetName) {
  const checksumsPath = path.join(electronDirectory, 'checksums.json');
  if (!fs.existsSync(checksumsPath)) return null;
  const checksums = JSON.parse(fs.readFileSync(checksumsPath, 'utf8'));
  return typeof checksums[assetName] === 'string' ? checksums[assetName] : null;
}

function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function cacheRoots() {
  const roots = [];
  if (process.env.electron_config_cache) roots.push(process.env.electron_config_cache);
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    roots.push(path.join(process.env.LOCALAPPDATA, 'electron', 'Cache'));
  } else if (process.platform === 'darwin') {
    roots.push(path.join(os.homedir(), 'Library', 'Caches', 'electron'));
  } else {
    roots.push(path.join(process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache'), 'electron'));
  }
  return roots.filter((candidate) => fs.existsSync(candidate));
}

function findCachedArchive(assetName) {
  for (const rootPath of cacheRoots()) {
    const direct = path.join(rootPath, assetName);
    if (fs.existsSync(direct)) return direct;
    for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(rootPath, entry.name, assetName);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function downloadArchive(url, destinationPath) {
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  if (process.platform === 'win32') {
    execFileSync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri $args[0] -OutFile $args[1]",
      url,
      destinationPath,
    ], { stdio: 'inherit', timeout: 600_000 });
  } else {
    execFileSync('curl', ['-fsSL', '-o', destinationPath, url], { stdio: 'inherit', timeout: 600_000 });
  }
  if (!fs.existsSync(destinationPath)) throw new Error(`download produced no archive at ${destinationPath}`);
}

function extractArchive(archivePath) {
  fs.rmSync(distDirectory, { recursive: true, force: true });
  fs.mkdirSync(distDirectory, { recursive: true });
  if (process.platform === 'win32') {
    execFileSync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "$ProgressPreference='SilentlyContinue'; Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force",
      archivePath,
      distDirectory,
    ], { stdio: 'inherit', timeout: 600_000 });
  } else {
    execFileSync('unzip', ['-oq', archivePath, '-d', distDirectory], { stdio: 'inherit', timeout: 600_000 });
  }
}

function main() {
  const relativePath = executableRelativePath();
  if (binaryPresent(relativePath)) {
    writePathFile(relativePath);
    process.stdout.write('ensure-electron-binary: Electron binary is already present.\n');
    return;
  }

  const installScript = path.join(electronDirectory, 'install.js');
  if (fs.existsSync(installScript)) {
    spawnSync(process.execPath, [installScript], {
      cwd: electronDirectory,
      stdio: 'inherit',
      timeout: 600_000,
    });
    if (binaryPresent(relativePath)) {
      writePathFile(relativePath);
      process.stdout.write('ensure-electron-binary: Electron install script produced the binary.\n');
      return;
    }
  }

  const version = electronVersion();
  const arch = process.env.npm_config_arch || process.arch;
  const assetName = `electron-v${version}-${process.platform}-${arch}.zip`;
  const expected = expectedChecksum(assetName);
  let archivePath = findCachedArchive(assetName);

  if (archivePath && expected && sha256(archivePath) !== expected) {
    process.stderr.write(`ensure-electron-binary: cached ${assetName} failed its checksum; obtaining a fresh copy.\n`);
    archivePath = null;
  }
  if (!archivePath) {
    const url = `https://github.com/electron/electron/releases/download/v${version}/${assetName}`;
    archivePath = path.join(os.tmpdir(), `material-tools-electron-${process.pid}-${assetName}`);
    process.stdout.write(`ensure-electron-binary: downloading ${url}\n`);
    downloadArchive(url, archivePath);
    if (expected && sha256(archivePath) !== expected) fail(`${assetName} does not match electron/checksums.json.`);
  }

  if (!expected) fail(`electron/checksums.json has no SHA-256 for ${assetName}.`);
  if (sha256(archivePath) !== expected) fail(`${assetName} failed its recorded SHA-256.`);
  process.stdout.write(`ensure-electron-binary: extracting verified ${archivePath}\n`);
  extractArchive(archivePath);
  if (!binaryPresent(relativePath)) fail(`extraction completed without ${relativePath}.`);
  writePathFile(relativePath);
  process.stdout.write('ensure-electron-binary: Electron binary restored from the verified archive.\n');
}

try {
  main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
