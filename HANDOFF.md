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

Original candidate verification before the two source repairs below:

- Final local renderer run: 20 files and 86 tests passed; release-workflow validation, both TypeScript boundaries, capture-harness syntax, and diff validation passed.
- Main application-operation boundary: 3 files and 31 tests passed, including fixed command construction, sender binding, one-use plans, cancellation, partial results, postcondition failure, and fixture non-execution.
- Documentation site: 8 files and 60 tests passed, followed by a successful production build.
- Local hidden-desktop capture proof: 19/19 states completed with strict target, exact URL, loopback debugger, privacy refusal, catalog/preview/progress/result/cancellation, 390×844 mobile touch emulation, and no sideways document overflow. All generated proof images were written outside the repository until the exact candidate commit is packaged.

These candidate changes are not described as delivered until their exact commit, release run, and Pages run are verified after the next push. Current documentation captures remain bound to the last verified release until fresh live and packaged-artifact captures replace them in a follow-up commit.

## Renderer replacement handoff

The next implementation owner is expected to replace the entire renderer UI from a new external design artifact. Treat the current renderer as a functional preservation reference, not as the next visual canon. Preserve or deliberately migrate the typed main/preload/shared application-management boundary, the generated 227-entry catalog, sender authorization, bounded command construction, one-use preview tokens, and fixture isolation while replacing the presentation layer.

Three accepted backend and lifecycle risks remain open and must not be hidden by the renderer replacement:

1. Cancellation and timeout abort the directly spawned process but do not prove that descendant installer processes stopped; a terminal `cancelled` state can therefore overstate containment (`src/main/application-capabilities.ts`, `src/main/application-operations.ts`).
2. A catalog entry may contain more than one manager package identifier. If the first package mutates the machine and a later package fails, the current result collapses that partial mutation into one failed or cancelled item (`src/shared/application-catalog.generated.ts`, `src/main/application-operations.ts`).
3. A preview whose package managers are all unavailable remains pending, blocks readiness scans, and has no visible discard route (`src/main/application-operations.ts`, `src/main.ts`, `src/renderer/App.tsx`).

The local upgrade-scope candidate now requires manager-specific installed evidence in the preview and again before execution. Every package identifier for an application is checked before its first mutation. Unavailable preview items remain unapproved even if installed state later changes. Chocolatey Upgrade uses the fixed `--fail-on-not-installed` guard and requires a recognized version 2 or later before accepting `list` as local evidence. Upgrade postverification uses the selected manager without fallback; Install behavior remains unchanged. The guard does not establish available upgrades, version changes, dependency behavior, rollback, or descendant-process containment. See [application management](docs/features/application-management.md) for the upstream documentation and scope.

The [upgrade-scope verification record](docs/architecture/upgrade-scope.md) records 37 synthetic regressions: the unchanged baseline failed 30 and passed 7; the repaired four main-process suites pass 75 tests. Standard `npm run check` passes 24 files and 161 tests, both additional Node suites (9 and 10 tests), both TypeScript checks, main/renderer builds, and bundled-preload validation. The new suite asserts zero calls to all seven mocked Node child-process entry points after every case. No real target command ran.

The synchronous progress-delivery risk is repaired in this source candidate. Notification delivery is best-effort and cannot change operation accounting; initial queued notifications are inside lifecycle cleanup. Seven synthetic regressions cover throws at queued, running, succeeded, failed, unavailable, cancelled, and every notification. They assert one terminal result per key, correct counts and aggregate status, lifecycle cleanup, fresh previews, and rejection of consumed tokens. The regressions failed against the unchanged executor (7 failed, 13 passed); the explicit main-process suite passes with the repair (3 files, 38 tests). All command runners are injected fakes or bypassed fixtures.

The test-discovery risk is also repaired: a dedicated Vitest configuration includes the main-process security suites in standard `npm test` and `npm run check`. Before the upgrade-scope repair, the combined source candidate covered 23 files and 124 tests, including the seven new progress regressions. The [test-discovery record](docs/architecture/test-discovery.md) preserves the real 86-test baseline, sentinel proof, and IPC-mutation proof from the separate discovery repair. The aggregate check includes both Node suites (9 and 10 tests), both TypeScript checks, main and renderer builds, and bundled-preload validation. This is source-only evidence, not native Windows acceptance, full-product parity, packaged-artifact evidence, or release verification. The three risks above remain unresolved.

The integrated local verification also passed the documentation site's 8 files and 60 tests, including its hand-written coverage/parity inventory, and its TypeScript/production build. That inventory checks claimed implemented slices and records planned gaps; it does not establish full-product parity. No workflow or site implementation changed, no real application-management or system-changing target command ran, and no release or Pages deployment was triggered.

The final accessibility, visual, and capture review was intentionally stopped for this handoff. Existing captures are candidate evidence only: their manifests still identify the prior verified commit, so the replacement owner must rebuild, recapture, and visually inspect the exact replacement commit before using them as release evidence.

## Remaining work

- Add available-upgrade discovery, uninstall, upgrade-all, redacted operation-log export, and a recovery executor to complete the remaining application-management parity slice.
- Implement all 67 tweaks, 33 AppX entries, 33 configuration actions, 14 DNS providers, update modes, automation paths, and Win11 Creator behavior.
- Complete every remaining universal feature across the desktop application and documentation site, including locks, authenticator, scheduled settings, local history, exports, bulk actions, narration, automatic updates, offline documentation, changelog, destructive confirmation, and dim-sum behavior.
- Replace foundation-only documentation-site implementations where the coverage inventory explicitly records a gap.
- Perform final release-grade integration, verification, ancestry proof, and authorized cleanup only after the full product goal is complete.

## Next action

Replace the renderer UI from the new design artifact while preserving or deliberately migrating the typed backend boundary. Resolve the three remaining risks above, retain main-process security coverage in the default test command, then run `build.bat /s` and `build-installer.bat /s`, recapture the packaged application and live documentation at the exact commit, visually inspect every capture, and publish only verified evidence after explicit publication authorization. The integrated repair is local-only; workflows are unchanged, and any branch push can trigger a Windows release.
