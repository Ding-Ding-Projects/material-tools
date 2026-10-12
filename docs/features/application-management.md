# Application management

## Behavior

The Install destination renders the 227-entry application catalog generated from `ChrisTitusTech/winutil@ea5de27b6c66fe4f4a4c6513887d0fe5a1cd8bff`. Users can search names, descriptions, categories, and package identifiers; combine category, package-source, detected-state, grid, and list views; select up to 25 applications; and inspect a removable review plan. Selection is planning state and never starts a package command.

Readiness scans are explicit and bounded. When a review plan exists, the scan examines up to 25 selected catalog keys. With no selection, it examines at most the first 64 current matches. The screen retains returned states while leaving unexamined entries labelled “Not detected.” It never performs an automatic startup scan.

A separate workspace supports Install and Upgrade. It requests a fresh one-use preview, shows the manager and readiness of every selected item, and requires explicit confirmation. Changing the selected keys or action makes the preview stale and disables confirmation. Execution reports per-item progress where it started, can be cancelled, preserves succeeded, failed, cancelled, and unavailable results separately, and offers a new read-only scan over the exact result set. Uninstall, available-upgrade discovery, upgrade-all, and operation-log export are not implemented.

## Configuration

The generated catalog lives in `src/shared/application-catalog.generated.ts`. Refresh it with:

```powershell
node scripts/import-winutil-applications.mjs
```

The importer reads the pinned upstream file through the GitHub CLI, requires exactly 227 unique records, bounds package-identifier arrays, rejects unsafe identifier syntax, validates HTTPS information URLs, and writes source commit and SHA-256 provenance into the generated module. It does not execute any imported value.

Application operations have no user-editable command field. The renderer supplies only generated catalog keys and either `install` or `upgrade`. Manager selection, executable, package identifiers, and arguments come from the generated catalog and fixed main-process command templates.

## Failure modes

- Upgrade previews require every selected package identifier for each application to be installed with the chosen manager. Execution rechecks that same manager and all identifiers before the application's first mutation. An unavailable preview never becomes authorized merely because installed state changes; create a new preview.
- Chocolatey Upgrade requires a recognized version 2 or later, where `list` reports local packages, and always adds the fixed `--fail-on-not-installed` guard. Older or unrecognized versions, failed queries, and missing managers fail closed with a verification reason. A confirmed missing package is reported separately from an unverifiable query. Manager preference is unchanged and execution never switches managers.
- Upgrade postconditions use only the selected manager. An installation reported by another manager cannot establish upgrade eligibility or success. Install behavior remains unchanged.
- If synchronous progress delivery throws, execution retains its actual item results and clears its lifecycle normally. Notifications can be lost when the renderer closes; this source-level containment is covered by injected tests, not a native Windows acceptance run.
- A missing or unsupported manager leaves affected preview items unavailable without guessing that a package is absent.
- A readiness scan can be cancelled. Returned states remain visible, and unexamined entries remain “Not detected.”
- A changed selection or action makes an old preview stale; a new preview is required.
- A command failure, timeout, or output-bound violation fails that item and continues to a truthful partial result when another item can proceed.
- A zero-exit command is still failed when the independent installed-state query does not report the application installed.
- Cancellation marks remaining items cancelled and removes the active cancellation action after the terminal result arrives.
- A pending plan expires after five minutes, is bound to the requesting renderer, and cannot be replayed.
- Documentation-capture fixture mode never invokes a package command and labels its preview, progress, notifications, and results as interface simulation.

These upgrade checks do not prove that a newer version exists or that the version changed. A command failure does not establish that nothing changed. Descendant installer containment, accurate per-package partial-mutation reporting, and a visible discard route for an all-unavailable pending plan remain unresolved.

The fixed guard follows the [Chocolatey Upgrade documentation](https://docs.chocolatey.org/en-us/choco/commands/upgrade/). The conservative version boundary follows the [Chocolatey v2 migration guide](https://docs.chocolatey.org/en-us/guides/upgrading-to-chocolatey-v2-v6/); older plain `list` output is not accepted as local installation evidence.

## Security considerations

The sandboxed renderer cannot send a manager name, executable, package identifier, argument, shell expression, path, or URL to the operation executor. IPC requests must originate from the one expected renderer `webContents` identifier and exact local application URL. The main process accepts at most 64 capability keys and 25 operation keys, stores at most one pending plan per renderer, issues a random 256-bit one-use token, and consumes that token before execution.

Manager probes, installed-state queries, package commands, and captured output all have explicit time and size bounds. Commands use `execFile` semantics with fixed argument arrays rather than a shell. Raw manager output is not returned to the renderer or written into notifications, captures, or repository logs. The application remains unsigned by policy and does not implement an elevation broker.

## Verification

Run:

```powershell
npm run check
npx vitest run --root . src/main/application-operations.test.ts src/main/application-capabilities.test.ts src/main/ipc-authorization.test.ts
```

The current main-process suite covers fixed command construction, manager choice, sender binding, request bounds, one-use and expiring previews, same-renderer preview replacement, cancellation, partial results, failed postconditions, and fixture non-execution. Renderer tests cover catalog filtering and selection, stale-preview detection, progress replacement, terminal summaries, touch targets, and the hand-written Install surface inventory.

The desktop capture harness drives 19 real rendered states from the built application. Its Install set opens the 227-entry catalog, filters to VLC, selects it, scans readiness, creates and confirms a preview, records progress and result, proves an action change stales the preview, cancels a separate 25-item run, verifies the no-command fixture disclosure, and exercises the catalog at 390×844 with touch emulation and no sideways document overflow.

![Application catalog in the built desktop application](../captures/foundation/install-catalog.png)

![Explicit application-operation preview in the built desktop application](../captures/foundation/install-preview.png)

![Application-operation progress in the built desktop application](../captures/foundation/install-progress.png)

![Application-operation terminal result in the built desktop application](../captures/foundation/install-result.png)

![Cancelled 25-item application operation in the built desktop application](../captures/foundation/install-cancelled.png)

![Application catalog at a 390 by 844 touch layout](../captures/foundation/install-narrow.png)

## Suggested articles

- [Security and process architecture](../architecture/security-and-processes.md)
- [Foundation shell](foundation-shell.md)
- [WinUtil parity contract](winutil-parity.md)
