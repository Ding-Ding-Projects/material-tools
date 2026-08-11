# Release evidence generation

The release workflow publishes each uniquely tagged build with its exact commit, unsigned-installer warning, public dim-sum catalog link, asset hashes, workflow timing, and committed line-count table.

The `push` trigger is explicitly limited to branches. Tags created by the release step do not trigger another release run, preventing a release-created tag from becoming an automation loop.

## Generation contract

Release notes use a literal PowerShell template with explicit placeholders. The workflow replaces every placeholder only after it has built and re-downloaded the installer, then edits the release and reads the body back. Publication fails if any placeholder or PowerShell expression remains unresolved, or if an expected filename, hash, timestamp, duration, or catalog filename is absent.

`npm run check:release-workflow` verifies this structure locally. The check also prevents test, lint, type-check, and static-analysis commands from entering GitHub Actions; those checks remain local by repository policy.

## Timing semantics

`Workflow started` comes from the Actions run's `run_started_at` value. `Workflow completed` is the release record's `publishedAt` value, so the duration measures from the start of the run through publication rather than from note generation. Both timestamps are normalized to UTC ISO-8601, and duration uses `HH:mm:ss`.

## Failure modes

- Missing Squirrel.Windows assets stop publication.
- A release targeting a different commit stops verification.
- A downloaded installer whose hash differs from the built installer stops verification.
- Unresolved note placeholders or missing evidence stop the workflow even after the initial release record exists; the release must then be corrected and read back before the repository can claim complete release evidence.
