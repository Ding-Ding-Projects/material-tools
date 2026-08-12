# Release evidence generation

The release workflow publishes each uniquely tagged build with its exact commit, unsigned-installer warning, public dim-sum catalog link, asset hashes, workflow timing, committed line-count table, concise interface summary, and commit-pinned repository captures.

The `push` trigger is explicitly limited to branches. Tags created by the release step do not trigger another release run, preventing a release-created tag from becoming an automation loop.

## Generation contract

Release notes use a literal PowerShell template with explicit placeholders. The workflow replaces every placeholder only after it has built and re-downloaded the installer, then edits the release and reads the body back. Publication fails if any placeholder or PowerShell expression remains unresolved, or if an expected filename, hash, timestamp, duration, or catalog filename is absent.

`npm run check:release-workflow` verifies this structure locally. It confirms that each release capture is both listed and embedded, that the tracked PNG files agree with their manifest byte counts and IHDR dimensions, and that no screenshot check enters GitHub Actions. The check also prevents direct or wrapped test, lint, type-check, and static-analysis commands from entering GitHub Actions; those checks remain local by repository policy.

`npm run check:line-count` verifies the hand-written text, binary, lockfile, and generated-evidence classifications. Binary assets contribute to the tracked-file total but never invent textual lines. Generated capture manifests and lockfiles retain their line totals in excluded rows, so the project total equals surviving-line attribution while the grand total still describes every tracked textual line.

## Timing semantics

`Workflow started` comes from the earliest job `started_at` value returned by the Actions jobs API. `Workflow completed` comes from the `completed_at` value of the completed **Publish and verify one unique release** step. The duration therefore spans the first job start through installer publication, re-download, and hash verification; it does not use run creation time or the release record's initial publication time. Both timestamps are normalized to UTC ISO-8601, negative durations fail closed, and duration uses `HH:mm:ss` with total hours rather than wrapping after 24 hours.

## Failure modes

- Missing Squirrel.Windows assets stop publication.
- A release targeting a different commit stops verification.
- A downloaded installer whose hash differs from the built installer stops verification.
- Missing job timing, a missing publication-step completion timestamp, or a negative duration stops release-note finalization.
- Unresolved note placeholders or missing evidence stop the workflow even after the initial release record exists; the release must then be corrected and read back before the repository can claim complete release evidence.
