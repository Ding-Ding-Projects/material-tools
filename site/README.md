# Material Tools

Material Tools is a mobile-first Material Design 3 documentation and feature-exploration surface for a Windows setup utility. It maps the public WinUtil workflow into an accessible, local-first interface while the desktop application is developed in parallel.

- Live site: <https://ding-ding-projects.github.io/material-tools/>
- Verified Windows installer: [`build-0.1.0.15`](https://github.com/Ding-Ding-Projects/material-tools/releases/download/build-0.1.0.15/MaterialTools-Setup-0.1.0-x64.exe) (unsigned, x64)
- Live-deployment capture manifest: [`docs/captures/site/manifest.json`](../docs/captures/site/manifest.json)

## Run locally

```powershell
npm install
npm run dev
```

Run the focused checks and production build:

```powershell
npm run test:run
npm run build
```

## Implemented surface

<details>
<summary>Navigation, search, and organization</summary>

- Browser-style tabs dockable to the left, right, top, or bottom; left is the default.
- Persistent pinning, grouping, collapsed groups, tab order, and dock position.
- Independent searches for the current strip, current group, group names, and all tabs.
- An adjacent anchored full regex builder for every implemented search field, contextual action panel, and group picker. Evaluation uses a deliberately conservative linear-time JavaScript `RegExp` subset.
- A global `Ctrl+Shift+F` command palette with direct navigation and live setting actions.

</details>

<details>
<summary>Personalization and accessibility</summary>

- English, playful Hong Kong-style Cantonese, and bilingual presentation across the primary navigation, landing copy, and article summaries.
- Independent five-level English and Cantonese funny-level controls wired to the landing copy.
- Persisted message-decoration toggle and a local School mode foundation.
- An always-visible, localized, bounded private-vocabulary JSON upload with version/schema validation, browser-only caching, reset/error state, and original wording when absent; no mappings or payloads are bundled.
- Light, dark, and system themes; searchable continuous HSL/HEX accent editing with automatic text contrast; density, text scale, and dock controls.
- Searchable per-tab and per-article appearance entry points with live previews.
- Keyboard navigation, visible focus, reduced-motion support, touch-sized targets, and narrow layouts.

</details>

<details>
<summary>Documentation and status</summary>

- Feature articles for Applications, Tweaks, Config & Fixes, Updates, Automation, and Win11 Creator.
- Commit-pinned links to the public upstream documentation supporting each capability list.
- Non-blocking corner notifications with a searchable, reviewable history.
- A hand-written coverage inventory checked by the test suite.
- A direct home-page download for the verified unsigned Windows installer, including its release tag and SHA-256 digest.
- Fifteen visually reviewed captures from the live Pages deployment at the recorded commit and workflow run.

</details>

## Privacy and hosting

The application makes no runtime API calls, uses no CDN, includes no analytics, and stores visitor preferences only in browser local storage. The GitHub Pages workflow builds and deploys the static site; it deliberately runs no tests or lint in GitHub Actions. Local checks are expected before changes are pushed.

See [the coverage inventory](docs/coverage-inventory.md) for implemented slices and known first-release limits.
