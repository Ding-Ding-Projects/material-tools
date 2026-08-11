# CI dependency inventory

## Workflow jobs

| Workflow | Job | Runner | Dependencies bootstrapped by the job | First real work |
|---|---|---|---|---|
| `release.yml` | `build-and-release` | `windows-2025` x64 | Git checkout, Node.js 24, npm lockfile packages, Electron 43.4.0, electron-builder 26.15.3, Squirrel.Windows vendor tools fetched by the pinned package | `build-installer.bat /s` |

The repository currently has no accessible self-hosted runner. Organization runner inventory was not readable with the current account permission, so the workflow uses the supported pinned GitHub-hosted `windows-2025` image. The job installs project dependencies from `package-lock.json` and does not assume a warm global Node or package cache.

The workflow intentionally runs no tests, lint, type checks, static analysis, accessibility checks, screenshot checks, or coverage. Those remain local task checks. It always collects safe build outputs without allowing collection failures to hide the original packaging result.

## Fresh-environment proof

The release job is the committed cache-miss proof: a fresh GitHub-hosted virtual machine checks out the intended commit, installs the declared Node runtime and npm packages, then reaches the real installer build without manual preparation. Add any future job to this hand-written table in the same change that creates it.
