# Foundation shell

## Behavior

The application is a real frameless Material Design 3 desktop shell. It reads live device facts without modifying the host, navigates through a responsive left tab rail, filters destinations through bounded plain-text or regex search, and opens a global command palette with `Ctrl+Shift+F`. The Install destination renders the complete 227-entry catalog pinned to the documented upstream revision, detects package-manager readiness through the sandboxed bridge, combines text, category, package-source, and detected-state filters, supports grid and list layouts, and builds a removable review plan without claiming that selection installed anything. The separate typed operation workspace accepts at most 25 catalog keys, builds a fresh install or upgrade preview, requires explicit confirmation of that preview, reports per-item progress, supports cancellation, renders honest terminal results, and offers a new read-only scan to verify the result. Settings and the notification center each have their own local search and adjacent full regular-expression builder. Every current feature page and implemented dialog, popover, notification, nested vocabulary surface, catalog, readiness panel, and operation-lifecycle surface carries its own bundled action illustration with localized alternative text. Accent editing stays inside the Material surface: a searchable HEX and continuous HSL editor replaces the browser's native color popup and keeps its full regex builder anchored beside its own search field.

## Configuration

Display name, language mode, independent English and Cantonese funny levels, theme, density, accent, and dialog-emoji preference persist in local browser storage. The accent editor accepts a complete six-digit HEX value or hue, saturation, and lightness sliders; valid changes update the Material color roles live. Renaming changes display text only; package identity and data paths remain stable.

## Failure modes

If the system summary, package-manager detection, preview, execution, or verification scan fails, an error notification remains visible in both the corner stack and reviewable notification center until reviewed. Informational corner notifications auto-dismiss while their history stays available. An incomplete or malformed HEX value remains visible for correction, is announced as invalid, and never replaces the last valid accent. Invalid or backtracking-shaped regular expressions remain local, receive inline feedback, and match no sections. Startup never scans package managers automatically. The user starts a button whose label states the exact scope: up to 25 selected applications, or up to 64 current matches when nothing is selected. Catalog items that have not been examined by a bounded capability query say “Not detected”; they are never guessed to be absent. Changing the selected keys or Install/Upgrade action makes an existing preview stale and disables confirmation until a new preview arrives. Unimplemented parity lanes render factual workflow and recovery previews labelled “Preview only,” without decorative action controls or invented success.

## Security considerations

The renderer has no direct operating-system or filesystem access. Only generated catalog keys and the chosen Install/Upgrade action cross into the operation bridge; package-manager executables, package identifiers, and arguments are resolved from the pinned catalog inside the main process. Search evaluation is local, caps patterns at 256 characters, samples at 4,000 characters, searchable text at 200,000 characters, and previews at 50 matches. A conservative linear-time subset rejects backreferences, lookarounds, nested or repeated ambiguous quantifiers, oversized repetition bounds, and other recognized catastrophic-backtracking shapes before constructing a regular expression.

## Verification

`npm run check` type-checks both process boundaries, runs the focused unit suite, and produces the main, preload, and renderer build outputs. `application-catalog-workspace.test.ts` verifies the 227-entry inventory stays reachable, real categories are derived, filters compose, detected/selected/unknown states remain distinct, invalid patterns report feedback, selection is capped at the shared 25-item operation limit, and bulk match selection does not duplicate entries. `application-operation-workspace.test.ts` verifies action and selection changes stale old previews, progress events replace rather than duplicate per-item rows, and terminal results retain separate succeeded, failed, cancelled, and unavailable counts. `application-operations.test.ts`, `application-capabilities.test.ts`, and `ipc-authorization.test.ts` exercise the real main-process operation boundary. `capability-workspace.test.ts` guards the hand-written preview inventory and its readiness language. `color-editor.test.ts` covers HEX validation and HSL conversion. `AnchoredRegexBuilder.test.tsx`, `regex-builder.test.ts`, and `search.test.ts` cover the complete rendered control inventory, independent owners, guided construction, raw flags, syntax feedback, live matches and capture groups, zero-width termination, copy/export data, bounds, and rejection before `RegExp` construction. `accent-color-editor-guard.test.mjs` rejects any return of a native color input or loss of an adjacent complete builder from any hand-written search owner. The capture harness drives the locally built unsigned Squirrel.Windows package on a hidden Win32 desktop and records 19 deterministic, non-device-specific states, including catalog, preview, progress, result, cancellation, and 390×844 touch layouts; the exact refreshed commit is recorded in the capture manifest.

![Material Tools overview in the real built desktop application](../captures/foundation/overview-dark.png)

![Material Tools command palette in the real built desktop application](../captures/foundation/command-palette.png)

![Material Tools overview at a narrow touch layout](../captures/foundation/overview-narrow.png)

![Material Tools application-operation preview in the real built desktop application](../captures/foundation/install-preview.png)

![Material Tools cancelled application operation in the real built desktop application](../captures/foundation/install-cancelled.png)

## Suggested articles

- [Security and process architecture](../architecture/security-and-processes.md)
- [Action illustrations](action-illustrations.md)
- [WinUtil parity contract](winutil-parity.md)
