# Handoff

## Current scope

Material Tools is a Windows Electron application pursuing full behavioral parity with Chris Titus Tech's WinUtil while implementing the repository's shared cross-surface product contract. The current deliverable is a verified, unsigned foundation—not a completed WinUtil replacement.

## Verified baseline

- Default-branch implementation baseline: `bd2d1130a9720d675ad64accd5f42bdba34c9ffc`.
- Upstream capability pin: `ChrisTitusTech/winutil@ea5de27b6c66fe4f4a4c6513887d0fe5a1cd8bff`.
- Verified release: [`build-0.1.0.15`](https://github.com/Ding-Ding-Projects/material-tools/releases/tag/build-0.1.0.15), targeting `bd2d1130a9720d675ad64accd5f42bdba34c9ffc`.
- Verified release workflow: [run 31539893235](https://github.com/Ding-Ding-Projects/material-tools/actions/runs/31539893235).
- Setup asset: `MaterialTools-Setup-0.1.0-x64.exe`, 143,247,360 bytes, SHA-256 `9b348c48b2fe0bdca6e7465820fef90226e88b9651f31143fa675e50efac2d54`.
- Live documentation: <https://ding-ding-projects.github.io/material-tools/>.
- Verified Pages deployment: [run 31539893262](https://github.com/Ding-Ding-Projects/material-tools/actions/runs/31539893262), serving `bd2d1130a9720d675ad64accd5f42bdba34c9ffc`.
- Private-vocabulary foundation: visible bounded local JSON controls in both the desktop application and documentation site, with original-wording fallback and no private payload in source, captures, logs, exports, releases, or public records.

## Current candidate changes

The working candidate adds twelve desktop captures and fifteen live-site captures with commit-bound manifests, embeds every capture in the README and relevant feature documentation, adds a reproducible live-site capture harness, places a direct verified installer download on the documentation Home surface, and replaces a stale hard-coded release-note test count with an honest reference to the tagged handoff.

Local verification for this candidate:

- Desktop: 5 test files and 16 tests passed; release-workflow validation, both TypeScript boundaries, production main/preload/renderer builds, and sandbox-preload validation passed.
- Documentation site: 7 test files and 34 tests passed; the production Vite build passed.
- Capture harness syntax and `git diff --check` passed.
- All 27 PNG files were opened and visually reviewed. The desktop set uses a visibly labelled deterministic fixture; the site set came from the live deployment in a fresh, extension-free hidden Edge profile.

These candidate changes are not described as delivered until their exact commit, release run, and Pages run are verified after the next push.

## Remaining work

- Implement all 227 application entries and their detection, planning, install, uninstall, upgrade, cancellation, verification, logging, and recovery behavior.
- Implement all 67 tweaks, 33 AppX entries, 33 configuration actions, 14 DNS providers, update modes, automation paths, and Win11 Creator behavior.
- Complete every remaining universal feature across the desktop application and documentation site, including locks, authenticator, scheduled settings, local history, exports, bulk actions, narration, automatic updates, offline documentation, changelog, destructive confirmation, and dim-sum behavior.
- Replace foundation-only documentation-site implementations where the coverage inventory explicitly records a gap.
- Perform final release-grade integration, verification, ancestry proof, and authorized cleanup only after the full product goal is complete.

## Next action

Push and verify the capture/download-link candidate, refresh the live capture affected by the new download control, then continue with the first consequential application-management executor slice.
