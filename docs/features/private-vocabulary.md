# Private vocabulary upload

## Behavior

The Settings destination always exposes a **Private vocabulary** file picker. A user may select a local JSON file containing approved literal user-interface wording replacements. The application validates the file before use, caches only the validated replacement table in local browser storage, applies replacements at rendered-copy and accessible-name boundaries, and leaves factual device values, paths, commands, URLs, identifiers, and other external records unchanged.

When no valid file is loaded, every shipped string remains unchanged. Clearing the local cache immediately restores shipped wording. Upload success, validation failure, and clearing are reported through non-blocking notifications. The setting includes a bundled action illustration whose localized alternative text follows the same approved rendered-copy boundary; the illustration never contains or derives from the uploaded file.

## Configuration

The accepted format is versioned and bounded:

```json
{
  "schemaVersion": 1,
  "entries": [
    {
      "original": "Example source wording",
      "replacement": "Example replacement wording"
    }
  ]
}
```

- Maximum UTF-8 file size: 256 KiB.
- Entry count: 1–512.
- `original`: non-empty, unique, at most 80 characters, without control characters.
- `replacement`: non-empty, at most 160 characters, without control characters.
- Matching is exact, case-sensitive, literal, and longest-match-first.

The examples above are neutral schema examples only. The repository, packages, captures, tests, logs, issues, releases, and documentation contain no user-supplied vocabulary payload.

## Failure modes

- Invalid JSON is rejected without changing the active cache.
- An unsupported schema version or missing `entries` array is rejected.
- Oversized, empty, duplicate, malformed, or control-character-bearing entries are rejected.
- An invalid previously cached value is ignored and shipped wording is used.
- File cancellation performs no action.

## Security and privacy

Parsing and replacement occur in the sandboxed renderer. The feature performs no network request and never writes the selected filename or payload to logs. Vocabulary data is excluded from ordinary exports, application packages, capture fixtures, issue evidence, release assets, and source control. Clearing affects only the app-local cache; it does not modify the file selected by the user.

## Verification

`src/renderer/lib/private-vocabulary.test.ts` covers valid parsing, literal longest-match replacement, invalid JSON, schema rejection, empty and duplicate entries, the 256 KiB bound, and unchanged fallback copy. `npm run check` also verifies TypeScript and the production renderer bundle. The built-artifact capture matrix includes the unloaded Settings state without supplying or exposing a private payload.

![Private vocabulary upload in the real built desktop Settings surface with no file loaded](../captures/foundation/settings-dark.png)

![Private vocabulary upload on the live documentation site with original wording active](../captures/site/private-vocabulary-unloaded.png)

## Suggested articles

- [Foundation shell](foundation-shell.md)
- [WinUtil parity contract](winutil-parity.md)
- [Security and process boundaries](../architecture/security-and-processes.md)
