# Upgrade scope safety

## Boundary

Upgrade eligibility requires every catalog package identifier for an application to be installed with the preview-selected manager. The executor rechecks the manager and every identifier before that application's first mutation, never switches managers, and uses that same manager for postverification. An unavailable preview cannot become execution authorization when machine state changes; the user must create another preview.

Chocolatey Upgrade adds the fixed `--fail-on-not-installed` argument. The application accepts only recognized Chocolatey versions 2 or later for upgrade installed-state queries because earlier plain `list` commands may return remote packages. Unknown or failed evidence produces an unavailable item with a verification reason; confirmed missing packages receive a distinct reason. Install commands and their existing verification path are unchanged.

Sources: [Chocolatey Upgrade](https://docs.chocolatey.org/en-us/choco/commands/upgrade/) and [Chocolatey v2 migration](https://docs.chocolatey.org/en-us/guides/upgrading-to-chocolatey-v2-v6/).

## Synthetic evidence

The same 37-case regression file was run against the unchanged integrated baseline and this repair:

- Baseline: 30 failed, 7 passed.
- Repair: all 37 passed; the four main-process suites total 75 passing tests.
- Standard `npm run check`: 24 files, 161 tests passed; both additional Node suites passed (9 and 10 tests), both TypeScript checks, main/renderer builds, and bundled-preload validation passed.
- Documentation site: 8 files, 60 tests passed, followed by its TypeScript/production build. An initial run had no terminal receipt; these results come from a complete clean rerun.

Every command runner is injected. The new suite mocks all seven synchronous and asynchronous Node child-process entry points to throw and asserts zero calls after every case. No real package-manager, installer, uninstall, operating-system, or security-changing command ran.

Coverage includes absent and partially installed GitHub Desktop identifiers; removal after preview; Chocolatey's invocation-time refusal after an intervening removal; exact fixed arguments; no fallback or cross-manager verification; missing, disappeared, old, and malformed managers; malformed/nonmatching output and failed queries; mixed item accounting; cancellation during preflight; consumed and sender-bound tokens; throwing progress delivery; raw-output non-disclosure; unchanged Install arguments; and fixture isolation.

## Limits

This is local source evidence, not native Windows acceptance, packaged application captures, version-change proof, available-upgrade discovery, or release verification. The fixed guard covers the requested package, not arbitrary dependency changes or installer scripts. A failed command does not prove that nothing changed.

Descendant-process containment, per-package partial-mutation accounting, and the all-unavailable pending-plan discard route remain open. Workflows are unchanged. Publication requires separate authorization.
