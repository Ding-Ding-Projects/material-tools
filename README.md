# Material Tools

Material Tools is a Windows Electron application being built to provide full behavioral parity with [Chris Titus Tech's WinUtil](https://github.com/ChrisTitusTech/winutil), wrapped in a secure Material Design 3 desktop experience.

> **Current status:** foundation build. The application launches, reports a real read-only system summary, exposes a frameless Material shell, persists core appearance and language settings, and includes a bounded regex search plus `Ctrl+Shift+F` command palette. System-changing WinUtil operations are deliberately unavailable until their preview, recovery, verification, and audit contracts are implemented.

## Start here

- Build the runnable application: `build.bat`
- Build the unsigned Squirrel.Windows installer: `build-installer.bat`
- Silent automation mode: `build.bat /s` or `build-installer.bat /s`
- Documentation: [docs/README.md](docs/README.md)
- Interactive documentation site source: [site/README.md](site/README.md)
- Delivery plan: [ROADMAP.md](ROADMAP.md)
- Current handoff: [HANDOFF.md](HANDOFF.md)

The installer is intentionally unsigned and may trigger an unknown-publisher or SmartScreen warning. Code signing is prohibited for this project.

<details>
<summary>Implemented foundation</summary>

- Sandboxed renderer with context isolation and a narrow typed preload bridge.
- Custom frameless title bar with working minimize, maximize/restore, and close controls.
- Real read-only device summary: operating-system release, architecture, processor, memory, elevation, and app version.
- Browser-style left tab rail with a responsive compact layout.
- Search bound to a local, bounded JavaScript regular-expression evaluator.
- Global command palette on `Ctrl+Shift+F`, including exact settings destinations.
- Persisted English, playful Hong Kong-style Cantonese, and bilingual modes.
- Independently persisted English and Cantonese funny-level controls.
- Persisted application display name, theme, density, accent, and dialog-emoji setting.
- Non-blocking error notifications.

</details>

<details>
<summary>WinUtil parity baseline</summary>

The capability contract is pinned to upstream commit `ea5de27b6c66fe4f4a4c6513887d0fe5a1cd8bff` and covers:

- 227 application catalog entries with WinGet and Chocolatey flows.
- 67 tweak actions and their registry, service, script, and undo behavior.
- 33 AppX entries, 33 configuration actions, and 14 DNS providers.
- Recommended, default, and disabled Windows Update modes plus repair.
- Presets, import/export, offline behavior, and automated configuration.
- Win11 Creator ISO validation, edition selection, driver injection, offline-image work, bootable export, USB writing, and cleanup.

Catalog display alone never counts as parity. Each operation must implement detection, plan, confirmation, application, verification, cancellation, partial-result reporting, and recovery where the upstream behavior permits it.

</details>

<details>
<summary>Build behavior</summary>

Both root scripts are designed for a fresh Windows checkout. They check for a supported Node.js runtime, use Windows Package Manager for a user-scoped LTS installation when needed, refresh the current process path, restore the lockfile exactly, and run the repository's supported build path.

`build-installer.bat` additionally requires the Squirrel.Windows outputs (`Setup.exe`, `RELEASES`, and a full `.nupkg`), verifies that the setup executable is unsigned, and reports its SHA-256 digest. It never publishes, tags, pushes, or creates a release.

</details>

<details>
<summary>Capture matrix</summary>

No release captures exist yet. The repository began with no application source, and the first built-artifact capture has not been verified. Real captures from a known built commit will be added for every destination, settings surface, editor, dialog, empty and error state, narrow layout, light theme, and dark/contrast theme. Mockups and hand-edited images are not accepted as evidence.

</details>

<details>
<summary>Sanitized shared product contract mirror</summary>

This project mirrors the globally shared delivery contract without private infrastructure details or private conversational vocabulary. Every user-facing desktop and documentation surface must implement the same language modes, independent funny-level controls, dialog-emoji setting, School mode, opt-in narration, scheduled and external settings, dim-sum surprise, bounded regex builders, non-blocking notifications and history, Material Design 3 appearance editors, browser-style tabs and searches, command palette, destructive-action confirmation, local history, changelog, external-editor handoff, complete exports, bulk actions, accessibility, responsive sizing, offline documentation, automatic updates, authenticator, and per-surface verification.

All Git work must preserve unrelated changes, use a task-appropriate isolated checkout when needed, run local verification, commit with the repository identity and bilingual message format, push completed work, and prove the default branch contains the result. Public records use ordinary technical vocabulary. Secrets, credentials, private host details, and installed dependency trees never enter the repository.

GitHub Actions builds, packages, publishes, and attaches evidence; it does not run tests, lint, type checks, static analysis, accessibility checks, or other release gates. Those checks remain local task requirements. Windows is the active delivery platform. Code signing is permanently prohibited. Every successful push or manual dispatch is expected to publish one unique non-draft release with a real installer, verified timing, line-count evidence from the committed counter, and the required public dim-sum catalog metadata.

</details>

## License and upstream

Material Tools is licensed under the [MIT License](LICENSE). WinUtil is an independent MIT-licensed upstream project; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). No upstream source has been copied into this foundation commit.
