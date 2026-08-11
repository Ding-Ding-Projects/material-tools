# Handoff

## Current scope

Material Tools is a Windows Electron application pursuing full behavioral parity with Chris Titus Tech's WinUtil while implementing the repository's shared cross-surface product contract. The current deliverable is a verified, unsigned foundation—not a completed WinUtil replacement.

## Verified baseline

- Default-branch implementation baseline: `101ea86c24e3ec94c4d4c0ebe026c423bfd9dca7`.
- Upstream capability pin: `ChrisTitusTech/winutil@ea5de27b6c66fe4f4a4c6513887d0fe5a1cd8bff`.
- Verified release: [`build-0.1.0.16`](https://github.com/Ding-Ding-Projects/material-tools/releases/tag/build-0.1.0.16), targeting `101ea86c24e3ec94c4d4c0ebe026c423bfd9dca7`.
- Verified release workflow: [run 31541667054](https://github.com/Ding-Ding-Projects/material-tools/actions/runs/31541667054).
- Setup asset: `MaterialTools-Setup-0.1.0-x64.exe`, 143,247,360 bytes, SHA-256 `4fe6f78b800a7ec3184df74afca06ba05d1acf6010fedc7ecfbd039a0da615a4`.
- Live documentation: <https://ding-ding-projects.github.io/material-tools/>.
- Verified Pages deployment: [run 31541666956](https://github.com/Ding-Ding-Projects/material-tools/actions/runs/31541666956), serving `101ea86c24e3ec94c4d4c0ebe026c423bfd9dca7`.
- Private-vocabulary foundation: visible bounded local JSON controls in both the desktop application and documentation site, with original-wording fallback and no private payload in source, captures, logs, exports, releases, or public records.

## Current candidate changes

The working candidate adds twelve locally bundled action illustrations and binds them to all seven current desktop feature pages plus every implemented command-palette, regular-expression builder, notification, and private-vocabulary surface. It also replaces raw accent coloring with contrast-tested Material Design 3 tonal roles and raises touched interaction targets to 48 px.

The documentation-site candidate adds a responsive Material Design 3 navigation drawer, compact local-vocabulary control and bottom sheet, deterministic focus restoration, local pin and overflow icons, short-landscape handling, and strict mobile/touch capture assertions. Both capture harnesses now require one exact normalized page target and a loopback debugger endpoint instead of choosing a prefix-matching target.

Local verification for this candidate:

- Desktop: 8 test files and 34 tests passed; release-workflow validation, both TypeScript boundaries, production main/preload/renderer builds, and sandbox-preload validation passed. The renderer build emitted all 12 WebPs.
- Documentation site: 7 test files and 39 tests passed; the production Vite build passed.
- Local hidden-browser capture: 19/19 states completed in 14.2 seconds with strict target, viewport, touch, overflow, modal, and focus assertions. The 320 px, 390 px, short-landscape, drawer, and private-vocabulary states were opened and visually reviewed.
- Capture harness syntax, private-vocabulary leakage scan, and `git diff --check` passed.

These candidate changes are not described as delivered until their exact commit, release run, and Pages run are verified after the next push. Current documentation captures remain bound to the last verified release until fresh live and packaged-artifact captures replace them in a follow-up commit.

## Remaining work

- Implement all 227 application entries and their detection, planning, install, uninstall, upgrade, cancellation, verification, logging, and recovery behavior.
- Implement all 67 tweaks, 33 AppX entries, 33 configuration actions, 14 DNS providers, update modes, automation paths, and Win11 Creator behavior.
- Complete every remaining universal feature across the desktop application and documentation site, including locks, authenticator, scheduled settings, local history, exports, bulk actions, narration, automatic updates, offline documentation, changelog, destructive confirmation, and dim-sum behavior.
- Replace foundation-only documentation-site implementations where the coverage inventory explicitly records a gap.
- Perform final release-grade integration, verification, ancestry proof, and authorized cleanup only after the full product goal is complete.

## Next action

Commit and publish the action-illustration and mobile Material candidate, verify its release and Pages deployment, capture the real packaged application and live site, refresh README evidence, then continue with the first consequential application-management executor slice.
