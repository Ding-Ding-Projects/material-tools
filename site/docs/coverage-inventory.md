# GitHub Pages coverage inventory

This inventory is intentionally hand-written. The corresponding source list is tested so a feature cannot disappear merely because an automatic scanner stopped finding it.

## Implemented now

- Material Design 3 responsive shell with no remote assets, analytics, or runtime data fetches.
- Four-edge browser-style tab docking with a left default.
- Persistent tab pinning, grouping, collapse state, order, and dock choice.
- Current-strip, current-group, group-name, and master searches, each with independent query, mode, flags, validation, and an anchored full regex builder.
- Searchable contextual tab actions and searchable move-into-group picker, each with its own anchored full regex builder.
- `Ctrl+Shift+F` command palette with navigation and live setting actions.
- English, playful Hong Kong-style Cantonese, and bilingual presentation on the primary navigation, landing copy, and article summaries.
- Independent five-level English and Cantonese funny-level controls wired to landing copy, plus a persisted message-decoration toggle.
- Non-blocking notifications and searchable notification history.
- Searchable global and per-element appearance controls with continuous HSL/HEX color editing and automatic text contrast.
- An always-visible, localized, bounded private-vocabulary JSON upload with version/schema validation, browser-only cache, clear/error state, and original wording when absent. No mappings or vocabulary payloads are bundled.
- Feature articles for Applications, Tweaks, Config & Fixes, Updates, Automation, and Win11 Creator, each with a commit-pinned public source.
- Keyboard focus, axis-aware tab navigation, reduced motion, touch-sized targets, and layouts from 320 px upward.
- Build-only GitHub Pages delivery workflow. Tests and lint do not run in Actions.

## First-release foundations that remain incomplete

- School mode demonstrates forced English, renaming, and control omission, but does not yet share state or an unlock credential with the desktop application.
- The language modes and funny levels are working foundations, but every control, article detail, notification, and accessible label is not yet fully localized or voice-styled.
- Private-vocabulary replacement is demonstrated in a local preview; applying it across every eligible user-facing text boundary remains future work.
- Per-element appearance editing currently covers tabs and article cards; Word-depth typography, continuous multi-space color translation, import/export, presets, locking, and every pseudo-state remain future work.
- Tab groups can be moved into, collapsed, searched, and persisted; group creation, renaming, visual decoration, and drag reordering remain future work.
- The command palette reaches every current page and core setting, but does not yet index every nested article paragraph or expose every setting as an inline control.
- Notification history supports search and dismissal; selection ranges, every bulk action, archive export, and destructive super-confirmation are not yet complete.
- Every-element contextual menus, bulk tab closing, complete tab-group authoring, and tab overflow management remain future phases.
- Authentication, tab and appearance locks, TOTP tools, Support Tickets, local version history, scheduled settings, changelog filtering, exports, bulk actions, narration, destructive confirmation, offline caching, dim-sum surprise, and real built-surface captures remain future phases.

## Source evidence

The capability articles cite public WinUtil documentation at commit `ea5de27b6c66fe4f4a4c6513887d0fe5a1cd8bff`. The static article catalog in `src/catalog.ts` is the canonical source list used by the site.
