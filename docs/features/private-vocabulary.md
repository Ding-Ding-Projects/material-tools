# Private vocabulary upload

## Behavior

The Settings destination always exposes a **Private vocabulary** file picker. A user may select a local JSON file containing approved literal user-interface wording replacements. The application validates the file before use, caches only the validated document in local browser storage, applies its `replacements` at rendered-copy and accessible-name boundaries, and leaves factual device values, paths, commands, URLs, identifiers, and other external records unchanged.

When no valid file is loaded, every shipped string remains unchanged. Clearing the local cache immediately restores shipped wording. Upload success, validation failure, and clearing are reported through non-blocking notifications. The setting includes a bundled action illustration whose localized alternative text follows the same approved rendered-copy boundary; the illustration never contains or derives from the uploaded file.

## Configuration

The accepted format is versioned and bounded:

```json
{
  "version": 1,
  "replacements": {
    "Example source wording": "Example replacement wording"
  },
  "required_phrases": {
    "example-id": "Example source wording"
  }
}
```

- Maximum UTF-8 file size: 64 KiB.
- Maximum nesting depth: two JSON object levels.
- `replacements` and `required_phrases`: JSON objects with at most 500 string entries each.
- Keys are non-empty, unique, at most 160 characters, free of control characters, and cannot use unsafe object-property names.
- Values are non-empty strings of at most 240 characters without control characters.
- Duplicate keys, unexpected top-level fields, unsupported versions, arrays, and nested values are rejected.
- Matching is exact, case-sensitive, literal, and longest-match-first.

The examples above are neutral schema examples only. The repository, packages, captures, tests, logs, issues, releases, and documentation contain no user-supplied vocabulary payload.

## Failure modes

- Invalid JSON is rejected without changing the active cache.
- An unsupported schema version or missing `replacements` or `required_phrases` object is rejected.
- Oversized, over-deep, duplicate-key, unsafe-key, malformed, or control-character-bearing input is rejected.
- An invalid previously cached value is ignored and shipped wording is used.
- A compatible cache written by the earlier `schemaVersion`/`entries` format is normalized to the shared version-1 object contract. A legacy cache outside the new bounds remains stored for manual recovery but is not applied or deleted automatically.
- A denied browser-storage read, migration write, corrupt-cache cleanup, upload write, or clear operation fails safely without preventing startup or claiming that persistence succeeded.
- File cancellation performs no action.

## Security and privacy

Parsing and replacement occur in the sandboxed renderer. The feature performs no network request and never writes the selected filename or payload to logs. Vocabulary data is excluded from ordinary exports, application packages, issue evidence, release assets, and source control. The capture harness may exercise the valid-load state with a bounded, neutral in-memory document that contains no user value, filename, or persisted residue; it clears that synthetic cache before continuing. Clearing affects only the app-local cache; it does not modify the file selected by the user.

## Verification

`src/renderer/lib/private-vocabulary.test.ts` covers the shared schema, literal longest-match replacement, malformed and duplicate-key JSON, unsafe keys, nesting, schema and field rejection, file/count/key/value bounds, compatible migration, incompatible-cache preservation, denied storage operations, corrupt-cache recovery, and unchanged fallback copy. `private-vocabulary-app-persistence.test.mjs` prevents mount-time cache deletion and confines persistence to explicit user actions. `npm run check` also verifies TypeScript and the production renderer bundle. The built-artifact capture matrix includes both the unloaded Settings state and a notification produced from a neutral, in-memory, automatically cleared document; no private payload is supplied or exposed.

![Private vocabulary upload in the real built desktop Settings surface with no file loaded](../captures/foundation/settings-dark.png)

![Private vocabulary upload on the live documentation site with original wording active](../captures/site/private-vocabulary-unloaded.png)

## Suggested articles

- [Foundation shell](foundation-shell.md)
- [WinUtil parity contract](winutil-parity.md)
- [Security and process boundaries](../architecture/security-and-processes.md)
