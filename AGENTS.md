# Repository instructions

This file is a sanitized project-local mirror of the shared delivery contract. The canonical user-level instructions remain authoritative; update the canonical source before refreshing this mirror.

## Product scope

- Build a Windows Electron application with full behavioral parity to the pinned ChrisTitusTech/winutil revision.
- Keep the renderer sandboxed and expose only typed operation identifiers through preload. Never expose arbitrary shell, PowerShell, filesystem, registry, service, package-manager, update, AppX, DISM, or ISO execution to renderer input.
- Model consequential operations as `detect → plan → confirm → apply → verify → undo`, with streaming progress, cancellation, append-only audit evidence, and honest partial results.
- Code signing is prohibited. Squirrel.Windows artifacts must remain unsigned and visibly documented as such.

## User-facing contract

Every desktop and documentation surface implements the full shared feature inventory: English, playful Hong Kong-style Cantonese, and bilingual modes; two independent funny-level controls; dialog emoji control; School mode; opt-in narrator; scheduled settings; dim-sum surprise; bounded regex builder on every search, dropdown, and context menu; notification center; Material Design 3 appearance editing; dockable browser-style tabs with pinning, groups, four searches, bulk close and locks; command palette on `Ctrl+Shift+F`; destructive-action super confirmation; local version history; changelog; complete exports; bulk actions; authenticator; offline docs; automatic updates; accessibility; narrow layouts; and real built-artifact captures.

No fake controls, sample documents, decorative interactions, silent skips, clipped content, inaccessible states, or unverified success claims are accepted. When a contract cannot apply literally, document the exact reason and implement the closest accessible testable equivalent.

## Search-field requirement

Every agent brief that creates or touches a search field must explicitly require the adjacent anchored full regex builder. Plain text remains the default. Each field owns its query, flags, validation, and mode; evaluation stays local, bounded, and protected from pathological patterns. Add every new field to the hand-written completeness inventory and verify it manually as well as automatically.

## Files and verification

- Use `apply_patch` for source and documentation edits. Preserve unrelated changes and inspect diffs before staging.
- Use `git` for local Git and `gh` for GitHub. Public text uses ordinary technical vocabulary.
- Run `npm run check` locally for foundation changes. Run relevant focused tests before a completed task is pushed.
- Keep README, ROADMAP, HANDOFF, categorized feature docs, landing page, wiki, Pages source, issue handoff, rolling Discussion, changelog, captures, and release evidence current in the same task as behavior.
- GitHub Actions must build/package/publish on `push` and `workflow_dispatch`, with no test, lint, type-check, static-analysis, coverage, screenshot, or accessibility gate.
- Every commit uses author and committer `Claude Fable 5 <noreply@anthropic.com>`, one exact `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer, a precise English subject, and a playful Hong Kong-style Cantonese counterpart in the body.
- Never commit secrets, installed dependencies, transient output, caches, generated probes, private paths, machine details, or private conversational vocabulary.

## Shared contract mirror

The complete sanitized mirror also appears in the README under “Sanitized shared product contract mirror.” Keep both copies synchronized. Private machine locations, account identifiers, LAN details, credentials, and private conversational aliases are intentionally omitted.
