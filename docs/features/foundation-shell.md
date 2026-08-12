# Foundation shell

## Behavior

The initial application is a real frameless Material Design 3 desktop shell. It reads live device facts without modifying the host, navigates through a responsive left tab rail, filters destinations through bounded plain-text or regex search, and opens a global command palette with `Ctrl+Shift+F`. Every current feature page and implemented dialog, popover, notification, and nested vocabulary surface carries its own bundled action illustration with localized alternative text. Accent editing stays inside the Material surface: a searchable HEX and continuous HSL editor replaces the browser's native color popup and keeps its full regex builder anchored beside its own search field.

## Configuration

Display name, language mode, independent English and Cantonese funny levels, theme, density, accent, and dialog-emoji preference persist in local browser storage. The accent editor accepts a complete six-digit HEX value or hue, saturation, and lightness sliders; valid changes update the Material color roles live. Renaming changes display text only; package identity and data paths remain stable.

## Failure modes

If the system summary fails, an error notification remains visible until dismissed. An incomplete or malformed HEX value remains visible for correction, is announced as invalid, and never replaces the last valid accent. Invalid or backtracking-shaped regular expressions remain local, receive inline feedback, and match no sections. Unimplemented parity lanes show an explicit unavailable state and disabled action with the unmet condition; they never imitate success.

## Security considerations

The renderer has no direct operating-system or filesystem access. Search evaluation is local, caps patterns at 256 characters, samples at 4,000 characters, searchable text at 200,000 characters, and previews at 50 matches. A conservative linear-time subset rejects backreferences, lookarounds, nested or repeated ambiguous quantifiers, oversized repetition bounds, and other recognized catastrophic-backtracking shapes before constructing a regular expression.

## Verification

`npm run check` type-checks both process boundaries, runs the focused unit suite, and produces the main, preload, and renderer build outputs. `color-editor.test.ts` covers HEX validation and HSL conversion. `AnchoredRegexBuilder.test.tsx`, `regex-builder.test.ts`, and `search.test.ts` cover the complete rendered control inventory, independent owners, guided construction, raw flags, syntax feedback, live matches and capture groups, zero-width termination, copy/export data, bounds, and rejection before `RegExp` construction. `accent-color-editor-guard.test.mjs` rejects any return of a native color input or loss of an adjacent complete builder from any hand-written search owner. The capture harness drives the locally built unsigned Squirrel.Windows package on a hidden Win32 desktop and records a deterministic, non-device-specific fixture; the exact refreshed commit is recorded in the capture manifest.

![Material Tools overview in the real built desktop application](../captures/foundation/overview-dark.png)

![Material Tools command palette in the real built desktop application](../captures/foundation/command-palette.png)

![Material Tools overview at a narrow touch layout](../captures/foundation/overview-narrow.png)

## Suggested articles

- [Security and process architecture](../architecture/security-and-processes.md)
- [Action illustrations](action-illustrations.md)
- [WinUtil parity contract](winutil-parity.md)
