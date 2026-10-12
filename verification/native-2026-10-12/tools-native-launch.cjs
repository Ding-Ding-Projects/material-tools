'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const workspace = path.resolve(__dirname, '..');
const root = path.join(__dirname, 'tools-native-data');
fs.mkdirSync(root, { recursive: true });
const env = { ...process.env, TOOLS_VERIFY_APP: path.join(workspace, 'tools-verify/dist/win-unpacked/resources/app.asar'),
  TOOLS_VERIFY_ROOT: root, TEMP: root, TMP: root, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' };
delete env.ELECTRON_RUN_AS_NODE;
const log = fs.createWriteStream(path.join(__dirname, 'tools-native.log'));
const runtime = path.join(workspace, 'tooling/electron43-runtime/electron.exe');
const host = path.join(__dirname, 'tools-native-host.cjs');
process.stdout.write('Native command: ' + runtime + ' ' + host + '\n');
const child = spawn(runtime, [host], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.on('data', data => { process.stdout.write(data); log.write(data); });
child.stderr.on('data', data => { process.stderr.write(data); log.write(data); });
child.on('error', error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.stdout.write(JSON.stringify({ code, signal }) + '\n'); log.end(); process.exitCode = code ?? 1; });
