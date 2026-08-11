# Security and process architecture

## Behavior

The Electron main process owns operating-system access. The renderer is sandboxed, has no Node.js integration, and receives a narrow frozen bridge from preload. The foundation bridge exposes a read-only system summary plus fixed window-control actions.

Future privileged operations accept typed catalog identifiers and validated parameters only. Arbitrary scripts, command strings, paths, registry keys, services, package identifiers, or URLs from renderer input are rejected. Consequential work follows detection, planning, confirmation, application, verification, and recovery stages.

## Configuration

The `webPreferences` contract requires `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and `webSecurity: true`. External links are denied in-app and opened only when they use HTTPS.

## Failure modes

- A read-only system query can fail or time out; the renderer receives a non-blocking error notification.
- An unavailable preload bridge is a build/runtime defect and must fail a real-artifact smoke test.
- Future broker elevation refusal must leave the plan unapplied and report the exact cancelled state.

## Security considerations

The application is unsigned by policy. Elevation must be short-lived and operation-scoped. Future IPC and broker messages require schema validation, origin binding, one-time session material, explicit allowlists, bounded output, and no credential logging.

## Verification

Run `npm run check`, inspect the compiled BrowserWindow preferences, and drive the built artifact on the approved hidden desktop. Unit tests alone do not prove preload wiring.

## Suggested articles

- [Foundation shell](../features/foundation-shell.md)
- [WinUtil parity contract](../features/winutil-parity.md)
