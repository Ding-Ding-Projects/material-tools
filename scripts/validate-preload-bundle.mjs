import { readFileSync, statSync } from 'node:fs';

const path = 'dist-electron/preload.js';
const source = readFileSync(path, 'utf8');
const size = statSync(path).size;

for (const value of ['contextBridge', 'system:get-summary', 'window:minimize', 'window:toggle-maximize', 'window:close']) {
  if (!source.includes(value)) throw new Error(`Bundled preload is missing: ${value}`);
}

for (const pattern of [/require\(["']\.\.?[/\\]shared[/\\]/, /require\(["']\.\.?[/\\]contracts/]) {
  if (pattern.test(source)) throw new Error(`Sandboxed preload retains an unsupported local require: ${pattern}`);
}

if (size > 256 * 1024) throw new Error(`Bundled preload is unexpectedly large: ${size} bytes.`);
console.log(`Sandbox-safe preload verified: ${path} (${size} bytes)`);
