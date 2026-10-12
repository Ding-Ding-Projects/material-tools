# Windows native verification preservation

Status: completed verification evidence preserved for review. This branch does
not change application behavior and is not an integration or release claim.

## Provenance

- Verified source and preservation base:
  `4fbfebb6daf29450eff7b032179198d8d0eba55b`.
- Verified source tree: `05bf0c1f6b9b4cfd3aa8422a0a0dfd756ef2a10c`.
- Windows x64; build Node 22.20.0; native Electron 43.4.0 / Node 24.18.1.
- Verified packaged `app.asar` SHA-256:
  `f27bf35aee0e027b6654c4fee0e47ae7947eb26c733a658c401e6b8cfd1269e5`.

The adjacent `.cjs` files are unchanged copies of the executed verification
harnesses. They preserve their original task layout and report source binding;
the host does not independently verify Git ancestry. They were not executed
again during preservation and are not a new portable runner. The launcher
expects sibling `tools-verify` and `tooling/electron43-runtime` directories
relative to its containing evidence directory. It writes local profiles, logs,
reports and captures alongside the harness. These outputs contain machine paths
and must not be committed. Review the layout before using a separate disposable
workspace.

## Completed checks

```text
# repository
npm.cmd ci --no-audit --no-fund
npm.cmd run check
node_modules/.bin/electron-builder.cmd --win --dir --publish never
# site directory
npm.cmd ci --no-audit --no-fund
npm.cmd run test:run
npm.cmd run build
# original verification workspace
node evidence/tools-native-launch.cjs
```

All 161 application tests, 19 Node tests and 60 site tests passed. Type checking,
application and site production builds, sandbox-preload validation and unpacked
Windows packaging passed. Packaged backend/preload/renderer files matched the
freshly compiled files. No installer was run or published.

Eight native scenarios passed; the launcher exited 0:

- Repeated confirmation invoked execution once.
- Three thrown progress-delivery callbacks preserved one successful terminal
  result and cleared lifecycle state.
- Repeated preflight cancellation prevented simulated package mutation.
- Missing packages disabled confirmation; packages removed after preview failed
  the execution preflight.
- Chocolatey version 1 was rejected before installed-state querying.
- Simulated command failure stayed failed without exposing raw command output.
- Unknown catalog keys and consumed-token replay were rejected by the typed
  verification host using the production authorization helpers.

The synthetic upgrade arguments included `--fail-on-not-installed`. Zero real
subprocess calls and zero network/external-operation attempts occurred.

## Acceptance limits and retained local exceptions

The unchanged packaged coordinator, preload and renderer ran in a hidden,
offscreen Electron window under a task-only typed IPC host with an injected
fake command runner. Production `main.ts` was not loaded. The screenshot UI
explicitly labels these operations as fixture simulations. These results do not
establish real package-manager, installer, physical-input or normal-startup
acceptance. The known unavailable-preview limitation remains: a pending plan
blocks scans without a visible discard control.

Raw reports, logs, PNG captures and temporary Chromium profiles remain local
because they contain resolved machine paths and diagnostics. Dependencies,
downloaded toolchains and unpacked build products also remain local. No user
applications or real package state were modified. Source scripts were inspected
for literal credentials, host/user paths and known private vocabulary before
inclusion. The synthetic nondisclosure sentinel is a test fixture, not a secret;
its presence does not sanitize any generated output.
