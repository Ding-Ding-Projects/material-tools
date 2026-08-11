# WinUtil parity contract

## Behavior

Parity is pinned to `ChrisTitusTech/winutil@ea5de27b6c66fe4f4a4c6513887d0fe5a1cd8bff`. It includes 227 applications, 67 tweaks, 33 AppX packages, 33 configuration actions, 14 DNS providers, three update-policy profiles, preset/config automation, and the complete Win11 Creator workflow.

Each catalog item requires actual detection and operation behavior. Rendering upstream names or descriptions without implementing the action is documentation, not parity.

## Configuration

A future pinned manifest will record the upstream repository, commit, catalog hashes, schema version, transformation version, and implementation status. HTTP configuration input is untrusted data: it is size-bounded, schema-validated, and never interpreted as executable code.

## Failure modes

Package managers, Store APIs, DISM, Windows Update, AppX, ISO tooling, and upstream identifiers change independently. Detection distinguishes unavailable tooling, unsupported operating-system versions, missing elevation, partial completion, restart requirements, and postcondition failure.

## Security considerations

Registry, service, package, AppX, update, ISO, and USB operations are privileged and potentially destructive. Plans name exact affected resources and recovery. USB writing, AppX removal, update disabling, and irreversible changes use the strongest in-app confirmation flow.

## Verification

The capability matrix requires direct tests for detect, plan, apply, verify, undo, cancellation, restart, unsupported, and partial-failure states where applicable. Built-artifact smoke tests verify the real preload and broker seams.

## Suggested articles

- [Security and process architecture](../architecture/security-and-processes.md)
- [Foundation shell](foundation-shell.md)
