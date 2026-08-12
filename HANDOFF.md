# Handoff

## Current scope

Material Tools is a Windows Electron application pursuing full behavioral parity with Chris Titus Tech's WinUtil while implementing the repository's shared cross-surface product contract. The current deliverable is a verified, unsigned foundation—not a completed WinUtil replacement.

## Verified baseline

- Default-branch implementation baseline: `12341f51b1b10b19cb077134d4b7e12941235a79`.
- Upstream capability pin: `ChrisTitusTech/winutil@ea5de27b6c66fe4f4a4c6513887d0fe5a1cd8bff`.
- Verified release: [`build-0.1.0.18`](https://github.com/Ding-Ding-Projects/material-tools/releases/tag/build-0.1.0.18), targeting `12341f51b1b10b19cb077134d4b7e12941235a79`.
- Verified release workflow: [run 31549333053](https://github.com/Ding-Ding-Projects/material-tools/actions/runs/31549333053).
- Setup asset: `MaterialTools-Setup-0.1.0-x64.exe`, 143,599,616 bytes, SHA-256 `b7cc69e61c7c6a9ea6cd089f517afd24f295d4f24b5d2af864588d2c14d0b6b3`.
- Live documentation: <https://ding-ding-projects.github.io/material-tools/>.
- Verified Pages deployment: [run 31549333063](https://github.com/Ding-Ding-Projects/material-tools/actions/runs/31549333063), serving `12341f51b1b10b19cb077134d4b7e12941235a79`.
- Private-vocabulary foundation: visible bounded local JSON controls in both the desktop application and documentation site, with original-wording fallback and no private payload in source, captures, logs, exports, releases, or public records.

## Current candidate changes

The working desktop candidate generates all 227 pinned application entries, adds explicit bounded WinGet/Chocolatey readiness scans, and implements a typed sender-bound Install/Upgrade lifecycle with one-use previews, explicit confirmation, per-item progress, cancellation, partial results, and installed-state postcondition verification. Five additional operation-specific images bring the bundled action-illustration inventory to seventeen and cover the catalog, readiness, review plan, progress, and recovery/result states. Uninstall and the Tweaks, Config, Updates, and MicroWin executors remain preview-only.

The desktop capture harness now requires one exact normalized page target and loopback debugger endpoint, refuses a pre-existing private-vocabulary cache before rendering diagnostics, reloads to a deterministic start, and drives 19 states. Its Install path searches VLC, selects it, scans readiness, proves an action change stales a preview, confirms and executes the fixture-only operation, captures progress/result, cancels a separate 25-item run, and verifies a 390×844 touch layout with no sideways document overflow or sub-48-pixel controls.

Local verification for this candidate:

- Final local renderer run: 20 files and 86 tests passed; release-workflow validation, both TypeScript boundaries, capture-harness syntax, and diff validation passed.
- Main application-operation boundary: 3 files and 31 tests passed, including fixed command construction, sender binding, one-use plans, cancellation, partial results, postcondition failure, and fixture non-execution.
- Documentation site: 8 files and 60 tests passed, followed by a successful production build.
- Local hidden-desktop capture proof: 19/19 states completed with strict target, exact URL, loopback debugger, privacy refusal, catalog/preview/progress/result/cancellation, 390×844 mobile touch emulation, and no sideways document overflow. All generated proof images were written outside the repository until the exact candidate commit is packaged.

These candidate changes are not described as delivered until their exact commit, release run, and Pages run are verified after the next push. Current documentation captures remain bound to the last verified release until fresh live and packaged-artifact captures replace them in a follow-up commit.

## Renderer replacement handoff

The next implementation owner is expected to replace the entire renderer UI from a new external design artifact. Treat the current renderer as a functional preservation reference, not as the next visual canon. Preserve or deliberately migrate the typed main/preload/shared application-management boundary, the generated 227-entry catalog, sender authorization, bounded command construction, one-use preview tokens, and fixture isolation while replacing the presentation layer.

Six accepted backend and lifecycle risks remain open and must not be hidden by the renderer replacement:

1. Chocolatey upgrade arguments do not first prove that a package is installed, so an upgrade request may install an absent application (`src/main/application-operations.ts`).
2. Cancellation and timeout abort the directly spawned process but do not prove that descendant installer processes stopped; a terminal `cancelled` state can therefore overstate containment (`src/main/application-capabilities.ts`, `src/main/application-operations.ts`).
3. A catalog entry may contain more than one manager package identifier. If the first package mutates the machine and a later package fails, the current result collapses that partial mutation into one failed or cancelled item (`src/shared/application-catalog.generated.ts`, `src/main/application-operations.ts`).
4. The normal `npm test` and `npm run check` paths root Vitest at the renderer and omit the main-process security tests. The omitted tests pass when invoked explicitly from the repository root, but the default local command does not prove them (`package.json`, `vite.config.mts`).
5. A preview whose package managers are all unavailable remains pending, blocks readiness scans, and has no visible discard route (`src/main/application-operations.ts`, `src/main.ts`, `src/renderer/App.tsx`).
6. The progress callback is not isolated from a throwing renderer send. A send failure can strand lifecycle state or turn an otherwise successful item into a failed result (`src/main.ts`, `src/main/application-operations.ts`).

The final accessibility, visual, and capture review was intentionally stopped for this handoff. Existing captures are candidate evidence only: their manifests still identify the prior verified commit, so the replacement owner must rebuild, recapture, and visually inspect the exact replacement commit before using them as release evidence.

## Remaining work

- Add available-upgrade discovery, uninstall, upgrade-all, redacted operation-log export, and a recovery executor to complete the remaining application-management parity slice.
- Implement all 67 tweaks, 33 AppX entries, 33 configuration actions, 14 DNS providers, update modes, automation paths, and Win11 Creator behavior.
- Complete every remaining universal feature across the desktop application and documentation site, including locks, authenticator, scheduled settings, local history, exports, bulk actions, narration, automatic updates, offline documentation, changelog, destructive confirmation, and dim-sum behavior.
- Replace foundation-only documentation-site implementations where the coverage inventory explicitly records a gap.
- Perform final release-grade integration, verification, ancestry proof, and authorized cleanup only after the full product goal is complete.

## Next action

Replace the renderer UI from the new design artifact while preserving or deliberately migrating the typed backend boundary. Resolve the six risks above, make the default test command include the main-process security suite, then run `build.bat /s` and `build-installer.bat /s`, recapture the packaged application and live documentation at the exact commit, visually inspect every capture, and publish only verified evidence.
