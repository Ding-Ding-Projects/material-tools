import { build } from 'esbuild';

await build({
  entryPoints: ['src/preload.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  outfile: 'dist-electron/preload.js',
  external: ['electron'],
  logLevel: 'info',
});
