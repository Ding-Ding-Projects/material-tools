# WinUtil parity contract

## Behavior

Parity is pinned to `ChrisTitusTech/winutil@ea5de27b6c66fe4f4a4c6513887d0fe5a1cd8bff`. It includes 227 applications, 67 tweaks, 33 AppX packages, 33 configuration actions, 14 DNS providers, three update-policy profiles, preset/config automation, and the complete Win11 Creator workflow. The complete application catalog is generated into `src/shared/application-catalog.generated.ts`; its provenance block records the exact repository, commit, source path, and SHA-256.

The current Install workspace provides real catalog discovery, bounded installed-state detection, filtering, selection, and review-plan behavior. Selection itself never executes anything. A separate allowlisted operation path supports install and upgrade for at most 25 catalog keys: it produces a fresh one-use preview, requires explicit confirmation, reports per-item progress, can be cancelled, preserves partial outcomes, and offers a bounded post-operation scan. Uninstall is not exposed. The Tweaks, Config, Updates, and MicroWin destinations still make their execution boundary explicit while presenting mapped workflow areas as non-interactive previews.

## Configuration

Run `node scripts/import-winutil-applications.mjs` to refresh the application catalog from the still-pinned source. The importer uses the authenticated GitHub CLI, requires exactly 227 unique object entries, validates HTTPS product links, converts package-manager fields into bounded identifier arrays, rejects shell syntax, and preserves the upstream MIT notice. HTTP configuration input remains untrusted data: it is size-bounded, schema-validated, and never interpreted as executable code.

## Failure modes

Package managers, Store APIs, DISM, Windows Update, AppX, ISO tooling, and upstream identifiers change independently. Package-manager detection runs only after an explicit user action and labels the exact bounded scope: up to 25 selected catalog items, otherwise up to 64 current matches. It distinguishes available, unavailable, unsupported, error, installed, not-installed, cancelled, and not-yet-detected states without collapsing them into a guessed result. Install and upgrade distinguish cancellation, partial completion, command failure, and installed-state postcondition failure. Elevation, restart requirements, uninstall, recovery execution, and the non-application parity lanes remain future work and are not implied by the interactive catalog.

## Security considerations

Registry, service, package, AppX, update, ISO, and USB operations are privileged and potentially destructive. The current application operation accepts only a generated catalog key and Install/Upgrade action; the main process resolves a fixed manager command and never accepts renderer-supplied package identifiers, executables, arguments, or shell text. Plans name every affected application and require explicit confirmation. USB writing, AppX removal, update disabling, uninstall, and irreversible changes are not exposed until their strongest in-app confirmation and recovery flows exist.

## Verification

The capability matrix requires direct tests for detect, plan, apply, verify, undo, cancellation, restart, unsupported, and partial-failure states where applicable. The current application-operation tests cover allowlisted key validation, the 25-item limit, package-manager choice, fixed arguments, one-use and expiring plans, renderer isolation, progress, cancellation, partial results, postcondition failure, capture-fixture non-execution, and real-host preview without mutation. The 19-state built-artifact capture harness verifies the real preload seam, the complete catalog, explicit readiness scope, stale-preview protection, confirmation, progress, terminal result, cancellation, no-command fixture disclosure, and 390×844 touch behavior.

## Suggested articles

- [Security and process architecture](../architecture/security-and-processes.md)
- [Foundation shell](foundation-shell.md)
