# Material Tools

Material Tools is a Windows Electron application being built to provide full behavioral parity with [Chris Titus Tech's WinUtil](https://github.com/ChrisTitusTech/winutil), wrapped in a secure Material Design 3 desktop experience.

> **Current status:** verified desktop foundation plus an in-progress application-management candidate. The application launches, reports a real read-only system summary, exposes a frameless Material shell with seed-derived tonal roles, persists core appearance and language settings, and includes bounded regex search plus the `Ctrl+Shift+F` command palette. The desktop candidate renders all 227 pinned application entries and implements bounded readiness scans plus typed, explicitly confirmed, cancellable Install/Upgrade operations with installed-state verification. Uninstall and the Tweaks, Config, Updates, and MicroWin executors remain unavailable. The exact candidate commit and release are not claimed until the next packaged build and capture pass complete.

## Start here

- Build the runnable application: `build.bat`
- Build the unsigned Squirrel.Windows installer: `build-installer.bat`
- Silent automation mode: `build.bat /s` or `build-installer.bat /s`
- Live documentation: <https://ding-ding-projects.github.io/material-tools/>
- Latest verified unsigned installer: [`build-0.1.0.18` for Windows x64](https://github.com/Ding-Ding-Projects/material-tools/releases/download/build-0.1.0.18/MaterialTools-Setup-0.1.0-x64.exe)
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
- Visible private-vocabulary upload and clear controls with bounded versioned validation, local-only caching, and unchanged shipped wording when no file is loaded.
- Non-blocking error notifications.
- Seventeen bundled action illustrations with localized alternative text, explicit feature/surface coverage, and no runtime network fetch.
- Material Design 3 tonal-role generation from the saved accent seed, including contrast checks for extreme seed colors.
- A mobile documentation drawer and private-vocabulary bottom sheet verified at 320 px, 390 px, and short landscape touch layouts.
- A generated 227-entry application catalog, explicit scoped WinGet/Chocolatey readiness scans, and grid/list review planning.
- A sender-bound Install/Upgrade lifecycle with a one-use preview, explicit confirmation, per-item progress, cancellation, terminal results, and installed-state verification.

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

The committed desktop captures currently come from the real locally built unsigned Squirrel.Windows package at commit `bd2d1130a9720d675ad64accd5f42bdba34c9ffc`, which is the target of verified release `build-0.1.0.15`. The newer application-management images referenced below will replace the old evidence only after the candidate is committed, packaged, driven, and visually verified; until then, the links intentionally identify the expected evidence paths rather than claiming existing provenance. A deterministic documentation fixture replaces device-specific facts and is visibly labelled in the application. The site captures came from the live GitHub Pages deployment for the earlier verified commit, verified by workflow run `31539893262`. No mockup, design export, user vocabulary payload, or hand-edited substitute is accepted as release evidence.

<details>
<summary>Desktop overview, themes, and narrow layout</summary>

![Desktop overview in dark theme with the labelled non-device-specific fixture](docs/captures/foundation/overview-dark.png)

![Desktop overview in light bilingual mode](docs/captures/foundation/overview-light-bilingual.png)

![Desktop overview at a narrow touch layout](docs/captures/foundation/overview-narrow.png)

</details>

<details>
<summary>Desktop application catalog and operation lifecycle</summary>

![Desktop application catalog with all 227 pinned entries](docs/captures/foundation/install-catalog.png)

![Desktop application operation preview with explicit confirmation](docs/captures/foundation/install-preview.png)

![Desktop application operation progress](docs/captures/foundation/install-progress.png)

![Desktop application operation terminal result and verification action](docs/captures/foundation/install-result.png)

![Desktop cancelled 25-item application operation](docs/captures/foundation/install-cancelled.png)

![Desktop application catalog at a 390 by 844 touch layout](docs/captures/foundation/install-narrow.png)

</details>

<details>
<summary>Desktop preview-only parity destinations</summary>

![Tweaks destination showing its honest unavailable foundation state](docs/captures/foundation/tweaks-unavailable.png)

![Config destination showing its honest unavailable foundation state](docs/captures/foundation/config-unavailable.png)

![Updates destination showing its honest unavailable foundation state](docs/captures/foundation/updates-unavailable.png)

![MicroWin destination showing its honest unavailable foundation state](docs/captures/foundation/microwin-unavailable.png)

</details>

<details>
<summary>Desktop settings, private vocabulary, command palette, and regex builder</summary>

![Desktop Settings in dark theme with every implemented foundation control](docs/captures/foundation/settings-dark.png)

![Desktop Settings in light bilingual mode](docs/captures/foundation/settings-light-bilingual.png)

![Desktop command palette opened in the running application](docs/captures/foundation/command-palette.png)

![Desktop command palette with its anchored regular-expression builder](docs/captures/foundation/regex-builder.png)

</details>

<details>
<summary>Live documentation home, articles, and narrow layout</summary>

![Live documentation home in light theme](docs/captures/site/overview-light.png)

![Live Applications documentation article](docs/captures/site/applications-article.png)

![Live Tweaks documentation article](docs/captures/site/tweaks-article.png)

![Live Config and Fixes documentation article](docs/captures/site/config-fixes-article.png)

![Live Updates documentation article](docs/captures/site/updates-article.png)

![Live Automation documentation article](docs/captures/site/automation-article.png)

![Live Win11 Creator documentation article](docs/captures/site/win11-creator-article.png)

![Live documentation home at a narrow touch layout](docs/captures/site/overview-narrow.png)

</details>

<details>
<summary>Live documentation settings and interactive tools</summary>

![Live documentation Settings surface in light theme](docs/captures/site/settings-light.png)

![Live private-vocabulary upload with original wording active and no file selected](docs/captures/site/private-vocabulary-unloaded.png)

![Live notification history surface](docs/captures/site/notifications.png)

![Live command palette](docs/captures/site/command-palette.png)

![Live command palette with its anchored regular-expression builder](docs/captures/site/command-regex-builder.png)

![Live four-scope tab discovery surface](docs/captures/site/tab-discovery.png)

![Live per-tab appearance editor](docs/captures/site/tab-appearance-editor.png)

</details>

Machine-readable provenance is recorded in [the desktop capture manifest](docs/captures/foundation/manifest.json) and [the live-site capture manifest](docs/captures/site/manifest.json).

</details>

<details>
<summary>Sanitized shared product contract mirror</summary>

This project mirrors the globally shared delivery contract without private infrastructure details or private conversational vocabulary. Every user-facing desktop and documentation surface must implement the same language modes, independent funny-level controls, dialog-emoji setting, School mode, opt-in narration, scheduled and external settings, dim-sum surprise, bounded regex builders, non-blocking notifications and history, Material Design 3 appearance editors, browser-style tabs and searches, command palette, destructive-action confirmation, local history, changelog, external-editor handoff, complete exports, bulk actions, accessibility, responsive sizing, offline documentation, automatic updates, authenticator, and per-surface verification.

All Git work must preserve unrelated changes, use a task-appropriate isolated checkout when needed, run local verification, commit with the repository identity and bilingual message format, push completed work, and prove the default branch contains the result. Public records use ordinary technical vocabulary. Secrets, credentials, private host details, and installed dependency trees never enter the repository.

GitHub Actions builds, packages, publishes, and attaches evidence; it does not run tests, lint, type checks, static analysis, accessibility checks, or other release gates. Those checks remain local task requirements. Windows is the active delivery platform. Code signing is permanently prohibited. Every successful push or manual dispatch is expected to publish one unique non-draft release with a real installer, verified timing, line-count evidence from the committed counter, and the required public dim-sum catalog metadata.

</details>

## License and upstream

Material Tools is licensed under the [MIT License](LICENSE). WinUtil is an independent MIT-licensed upstream project; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). No upstream source has been copied into this foundation commit.
