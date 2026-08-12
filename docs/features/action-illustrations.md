# Action illustrations

## Behavior

Every currently implemented desktop feature page has its own bundled, action-specific illustration: Overview, Install, Tweaks, Config, Updates, MicroWin, and Settings. The real command-palette dialog, every anchored regular-expression builder, non-blocking notifications, Private vocabulary setting, application catalog, package-manager readiness panel, review plan, progress preview, and recovery preview use separate illustrations that describe their specific action rather than repeating a generic hero image.

Illustrations are informative content. Each image has meaningful English and Cantonese alternative text, bilingual mode presents both descriptions, and a validated private vocabulary may transform the approved user-interface wording at the same rendered-copy boundary. Images use asynchronous decoding; page and settings art loads lazily where appropriate, while illustrations in a newly opened dialog, popover, or notification load eagerly.

## Configuration

Illustration coverage is intentionally hand-written in `src/renderer/action-illustrations.ts`. The inventory lists all seven current feature pages and all nine implemented transient, nested, and workflow surfaces. A reusable renderer component applies the same local asset loading, alternative-text localization, responsive sizing, Material Design 3 shape, outline, surface, and elevation treatment.

The images are not controls and are not styled as controls. They do not accept clicks, change state, or imply that an unavailable action can run.

## Current exceptions

- The generated destructive-confirmation illustration is bundled and cataloged, but it is not rendered because the foundation build does not yet implement a real destructive-action confirmation dialog. The application does not invent a decorative confirmation flow merely to display the asset.
- The vocabulary file chooser is a native operating-system dialog and cannot contain application-rendered content. Its in-app trigger and explanatory setting sit directly beside the Private vocabulary illustration.

## Failure modes

- A missing or renamed asset import fails the renderer build instead of silently falling back to a remote image or an empty placeholder.
- The hand-written coverage test fails when a current feature page or implemented surface is removed from its required illustration inventory.
- If an image cannot decode at runtime, its localized alternative text still communicates the intended action.
- The built-artifact capture harness forces deferred images to eager loading and refuses to photograph a state until every image has completed with non-zero natural dimensions. A blank lazy image is therefore a failed capture, not accepted evidence.

## Security and privacy

All illustration files ship inside the application package. Rendering performs no network request and does not expose a file path, device fact, account, vocabulary payload, or other user data. The padlock motif in the Private vocabulary art communicates local-only handling; it is illustrative and does not claim encryption or a security boundary.

## Verification

`src/renderer/lib/action-illustrations.test.ts` checks all seven feature pages and nine implemented surfaces, bundled WebP references, bilingual alternative text, real renderer bindings, and the documented destructive-confirmation exception. `src/renderer/lib/capture-harness-privacy.test.mjs` guards image readiness before capture and the Material file-picker anatomy. Type checking and the production renderer build verify that every imported asset is packageable.

## Suggested articles

- [Foundation shell](foundation-shell.md)
- [Private vocabulary upload](private-vocabulary.md)
- [WinUtil parity contract](winutil-parity.md)
