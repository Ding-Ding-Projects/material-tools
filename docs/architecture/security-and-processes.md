# Security and process architecture

## Behavior

The Electron main process owns operating-system access. The renderer is sandboxed, has no Node.js integration, and receives a narrow frozen bridge from preload. The bridge exposes a read-only system summary, bounded application-capability queries, a typed install/upgrade operation lifecycle, progress subscription, cancellation, and fixed window-control actions.

Application operations accept only generated catalog keys and an `install` or `upgrade` action. The main process—not the renderer—resolves the allowlisted package manager, executable, package identifiers, and arguments from the pinned catalog. Arbitrary scripts, command strings, paths, registry keys, services, package identifiers, executables, arguments, or URLs from renderer input are rejected. Each operation follows detection, a fresh one-use preview, explicit renderer confirmation, application, bounded installed-state verification, cancellable progress, and a terminal result. Uninstall and the Tweaks, Config, Updates, and MicroWin executors remain unavailable.

## Configuration

The `webPreferences` contract requires `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and `webSecurity: true`. Every IPC request is bound to the one expected renderer `webContents` identifier and exact local file URL. External links are denied in-app and opened only when they use HTTPS. The preload is bundled into one CommonJS file because a sandboxed preload cannot load arbitrary neighboring modules; `npm run check:preload` rejects a compiled bridge that retains local `require` calls or loses any allowed channel.

Capability queries accept at most 64 generated catalog keys and use four-second, 64 KiB manager probes plus twelve-second, 256 KiB installed-state probes. An operation preview accepts at most 25 keys, stores at most one pending plan per renderer, expires after five minutes, and produces a random 256-bit token. Execution arguments are built from fixed templates, mutation output is bounded to 1 MiB, and execution is bounded to five minutes per command. A token is consumed before execution and cannot be replayed. Documentation-capture fixture mode never invokes the command runner and labels its preview, progress, notifications, and results as interface simulation.

## Failure modes

- Upgrade eligibility and postverification are manager-specific. Every package identifier for the current application must pass installed-state preflight before its first mutation; an unavailable preview stays unavailable until replaced. Chocolatey Upgrade always uses `--fail-on-not-installed` and rejects pre-v2 or unrecognized manager versions before querying installed state. This is source-tested scope protection, not native Windows acceptance or proof of descendant-process containment.
- Synchronous progress-delivery exceptions are contained without logging the exception or payload. Delivery remains best-effort; a disconnected renderer may miss notifications, but notification failures do not alter item outcomes or prevent lifecycle cleanup. This does not prove native window-close behavior or descendant-process containment.
- A read-only system query can fail or time out; the renderer receives a non-blocking error notification.
- A capability query can be unavailable, unsupported, cancelled, or fail; already returned states remain distinguishable from applications that were never examined.
- A stale operation preview cannot be confirmed after its selected keys or action change. The user creates a new preview instead.
- A package-manager process can fail, time out, or return successfully without satisfying the installed-state postcondition. The result remains failed or partial and exposes a new read-only verification scan.
- Cancelling an active operation marks every remaining item cancelled and removes the in-place cancellation action after the terminal result arrives.
- An unavailable preload bridge is a build/runtime defect and must fail a real-artifact smoke test.
- Elevation is not implemented. A package manager that requires privileges reports its real failure; no broker or hidden elevation fallback exists.

## Security considerations

The application is unsigned by policy. It never accepts shell text from the renderer and never invokes a shell for application management. Manager selection, package identifiers, executables, arguments, origin binding, one-time session material, output bounds, and timeouts are enforced in the main process. Package-manager output is not returned to the renderer or written into notifications, captures, or logs. Future privileged broker work must be short-lived and operation-scoped and must preserve these boundaries.

## Verification

Run `npm run check`, `npx vitest run --root . src/main/application-operations.test.ts src/main/application-capabilities.test.ts src/main/ipc-authorization.test.ts`, inspect the compiled BrowserWindow preferences, and drive the built artifact on the approved hidden desktop. The main-process tests cover sender binding, request bounds, fixed commands, one-use and expiring previews, replacement and cancellation, partial results, postcondition failure, and capture-fixture non-execution. The built-artifact capture harness proves the real preload seam, stale-preview protection, explicit confirmation, progress, terminal result, cancellation, and privacy-safe fixture disclosure. Unit tests alone do not prove preload wiring.

## Suggested articles

- [Foundation shell](../features/foundation-shell.md)
- [WinUtil parity contract](../features/winutil-parity.md)
