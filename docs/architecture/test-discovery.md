# Main-process and renderer test discovery

The integrated source candidate also includes seven progress-delivery regressions.
Its standard test run covers 23 files and 124 tests (86 renderer and 38 main-process
tests). This is synthetic source-level evidence only; native Windows behavior,
installer acceptance, refreshed captures, and full-product parity remain unverified.
The integrated `npm run check` also passes both Node suites (9 and 10 tests),
both TypeScript checks, main/renderer builds, and bundled-preload validation.
The unchanged documentation site passes its 8 files and 60 tests, including
coverage-inventory checks, and its TypeScript/production build. These inventory
checks cover implemented slices and retain documented full-product gaps.

`npm test`, `npm run test:watch`, and the test stage of `npm run check` use
`vitest.config.mts`. This dedicated configuration discovers Vitest's default test
filename patterns throughout `src/`, including both `src/main` and
`src/renderer`. It retains the React transform required by renderer component
tests. Vite's application build configuration and renderer build root are
unchanged. The separate Node test suites in `scripts/` still run through their
existing check commands.

Previously, Vitest inherited `root: 'src/renderer'` from `vite.config.mts`, so the
normal test and aggregate check commands omitted the main-process suites for
IPC authorization, application capabilities, and application operations.

## Local verification

The following checks were performed against base revision
`9c407a81e9e4e30dc922cf955e83232dd5aeb754` with only this discovery configuration
added. Counts describe that revision, before other executor fixes are combined.

- Baseline `npm test`: 20 renderer files and 86 tests passed.
- A temporary main-process test that always threw a distinctive error was
  silently omitted by baseline `npm test`, which still passed those 86 tests.
- With the dedicated configuration, the same standard command failed on the
  temporary test while 23 real files and 117 real tests passed. The temporary
  test was then removed.
- A temporary mutation changed the IPC sender ID comparison from exact equality
  to greater-than-or-equal. Both `npm test` and `npm run check` failed the existing
  test that rejects another web contents. No assertions were changed or skipped.
- After restoring the exact comparison, `npm run check` passed: the two Node
  suites (9 and 10 tests), both TypeScript checks, all 23 Vitest files and 117
  tests, the main and renderer builds, and bundled-preload validation.

The capability and operation suites used their existing injected command
runners and synthetic fixtures. No package-manager, install, uninstall, or
system-changing target commands were executed. Temporary probes and mutations
are not part of the delivered change. These checks establish source-level test
coverage; they do not establish Windows runtime or installer validation.
