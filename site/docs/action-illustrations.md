# Action illustrations

Every currently implemented feature destination and overlay surface includes a relevant, locally bundled action illustration. This covers the overview, six upstream capability articles, Settings, Notifications, private vocabulary, tab discovery, the mobile navigation sheet, tab actions, the group picker, the appearance editor, the command palette, every regex-builder popover, notification history, and live corner notifications.

## Behavior

- Images use a consistent 3:2 composition and Material Design 3 surface, outline, shape, and elevation roles.
- `object-fit: contain` preserves the complete action scene instead of cropping away controls or context.
- Feature cards and article headers share the same action binding, while each overlay has a binding that describes the action performed there.
- English, Cantonese, and bilingual alternatives follow the active language mode. School mode forces the English alternative with the rest of the presentation.
- Images are informative but never interactive. Every button, search field, and menu action remains a real control with its existing keyboard and accessible behavior.

## Configuration

The hand-written inventories live in `src/action-illustrations.ts`:

- `requiredFeatureIllustrationSurfaces` lists every implemented feature-level surface.
- `requiredOverlayIllustrationSurfaces` lists every implemented dialog, popover, sheet, and notification surface.
- `actionIllustrationBindings` maps each surface to one local WebP and two localized alternatives.
- `articleIllustrationSurfaces` maps each upstream article identifier to its required feature binding.

Adding a new implemented surface requires adding its identifier, local binding, localized alternatives, render path, and test coverage in the same change.

## Failure modes

- A missing file fails the production build because every image URL is statically resolved from the site source.
- A missing or extra binding fails the exact inventory test.
- An article without a registered action image throws an explicit error instead of rendering an empty placeholder.
- Narrow layouts use bounded widths, fixed aspect ratios, internal scrolling on overlays, and responsive stacking from 320 pixels upward.
- The live-site capture harness forces deferred images to eager loading and refuses to photograph until every image has completed with non-zero natural dimensions, so blank lazy placeholders cannot enter the published evidence set.

## Security and privacy

All images are stored below `src/assets/action-illustrations`. The site does not fetch images from a CDN, remote host, analytics service, or runtime API. Images contain no credentials, private vocabulary entries, device paths, or user data.

## Verification

`src/action-illustrations.test.tsx` checks the exact hand-written inventories, local WebP bindings, article coverage, feature destinations, every implemented overlay/message surface, narrow mobile navigation, and localized alternatives. The shared capture-harness contract guards image readiness and the minimum-width installer action before photography. The normal site test and production-build commands also verify that the assets compile and are emitted with the static site.
