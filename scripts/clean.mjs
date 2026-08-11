import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
for (const relativePath of ['dist', 'dist-electron']) {
  await rm(resolve(projectRoot, relativePath), { recursive: true, force: true });
}
