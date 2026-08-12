import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const captureSource = readFileSync(new URL('../../../scripts/capture-ui.mjs', import.meta.url), 'utf8');
const siteCaptureSource = readFileSync(new URL('../../../scripts/capture-site.mjs', import.meta.url), 'utf8');
const siteAppSource = readFileSync(new URL('../../../site/src/App.tsx', import.meta.url), 'utf8');
const siteStylesSource = readFileSync(new URL('../../../site/src/styles.css', import.meta.url), 'utf8');
const desktopStylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

describe('private-vocabulary capture harness privacy', () => {
  it('refuses a pre-existing cache before the first capture', () => {
    const runtimeEnabled = captureSource.indexOf("await send('Runtime.enable')");
    const cacheProbe = captureSource.indexOf("localStorage.getItem('material-tools.private-vocabulary.v1') === null");
    const firstPageWait = captureSource.indexOf("await waitFor(\"Boolean(document.querySelector('.fact-grid'))\"");
    const refusal = captureSource.indexOf('Capture refused: the selected profile already contains a private-vocabulary cache.');
    const reload = captureSource.indexOf("await send('Page.reload', { ignoreCache: true })");
    const firstCapture = captureSource.indexOf("await capture('overview-dark'");
    expect(cacheProbe).toBeGreaterThan(runtimeEnabled);
    expect(firstPageWait).toBeGreaterThan(cacheProbe);
    expect(refusal).toBeGreaterThan(-1);
    expect(reload).toBeGreaterThan(refusal);
    expect(firstPageWait).toBeGreaterThan(reload);
    expect(firstCapture).toBeGreaterThan(refusal);
    expect(captureSource).toContain("localStorage.getItem('material-tools.private-vocabulary.v1') === null");
  });

  it('uses only the neutral shared schema and clears its cache on every exit path', () => {
    expect(captureSource).toContain('let fixtureClearVerified = false;');
    expect(captureSource).toContain('finally {');
    expect(captureSource).toContain("localStorage.removeItem('material-tools.private-vocabulary.v1'); true");
    expect(captureSource).toContain('version: 1');
    expect(captureSource).toContain('replacements: {');
    expect(captureSource).toContain('required_phrases: {}');
    expect(captureSource).not.toContain('PERSONAL_VOCABULARY.json');
  });

  it('drives the full fixture-only application operation without confusing it for a real package command', () => {
    for (const marker of [
      "await capture('install-catalog'",
      "await capture('install-preview'",
      "await capture('install-progress'",
      "await capture('install-result'",
      "await capture('install-cancelled'",
      "await capture('install-narrow'",
      'No package-manager command runs in this capture',
      'selection or action changed',
      '25 cancelled',
    ]) expect(captureSource).toContain(marker);
    expect(captureSource).toContain("await send('Page.reload', { ignoreCache: true })");
    expect(captureSource).toContain('shortTargets.length > 0');
    expect(captureSource).not.toContain("['Install', 'install-unavailable']");
  });
});

describe('capture image readiness', () => {
  it.each([
    ['packaged application', captureSource],
    ['live site', siteCaptureSource],
  ])('refuses to photograph unloaded images in the %s harness', (_surface, source) => {
    expect(source).toContain("image.loading = 'eager'");
    expect(source).toContain('image.complete && image.naturalWidth > 0 && image.naturalHeight > 0');
    expect(source.indexOf('image.naturalWidth > 0')).toBeLessThan(source.indexOf("send('Page.captureScreenshot'"));
  });
});

describe('minimum-width installer action', () => {
  it('keeps the three visible label segments separated when the action wraps', () => {
    expect(siteAppSource).toContain('className="filled-button link-button installer-download"');
    expect(siteAppSource).toContain('<span data-private-vocabulary-verbatim>{verifiedInstaller.version}</span>');
    const ruleStart = siteStylesSource.indexOf('.installer-download {');
    const ruleEnd = siteStylesSource.indexOf('}', ruleStart);
    const rule = siteStylesSource.slice(ruleStart, ruleEnd + 1);
    expect(ruleStart).toBeGreaterThan(-1);
    expect(rule).toContain('column-gap: 0.35ch');
    expect(rule).toContain('flex-wrap: wrap');
    expect(rule).toContain('text-align: center');
  });

  it('measures the rendered installer segments and photographs the opened compact proof', () => {
    expect(siteCaptureSource).toContain('async function assertMobileOverviewGeometry(label, expectCompactProof)');
    expect(siteCaptureSource).toContain("action?.querySelectorAll(':scope > span')");
    expect(siteCaptureSource).toContain("labelText === 'Download 0.1.0 for Windows (x64)'");
    expect(siteCaptureSource).toContain('bounds.left - previous.right >= 0.5');
    expect(siteCaptureSource).toContain('proofBounds.height >= 48');
    expect(siteCaptureSource).toContain('const expectsCompactProof = width <= 760 || (height <= 500 && width <= 900)');
    expect(siteCaptureSource).toContain("const proofSelector = expectsCompactProof ? '.release-proof--compact > summary'");
    expect(siteCaptureSource).toContain('`${name} responsive installer proof`');
    expect(siteCaptureSource).toContain("await send('Page.reload', { ignoreCache: true })");
    expect(siteCaptureSource).toContain("const mobileReloadOrigin = await evaluate('performance.timeOrigin')");
    expect(siteCaptureSource).toContain("'the new mobile document'");
    expect(siteCaptureSource).toContain("'the reloaded mobile application shell'");
    expect(siteCaptureSource).toContain("Boolean(document.querySelector('#tab-overview'))");
    expect(siteCaptureSource).toContain("Boolean(document.querySelector('#panel-overview'))");
    expect(siteCaptureSource).toContain("await capture('overview-release-proof-mobile'");
    expect(siteCaptureSource).toContain('bodyBounds.bottom <= innerHeight + 1');
  });
});

describe('Material 3 private-vocabulary file picker', () => {
  it('owns a styled surface, styled native button, and visible keyboard focus', () => {
    expect(desktopStylesSource).toContain('.settings-stack input[type="file"] {');
    const buttonRuleStart = desktopStylesSource.indexOf('.settings-stack input[type="file"]::file-selector-button {');
    const buttonRuleEnd = desktopStylesSource.indexOf('}', buttonRuleStart);
    const buttonRule = desktopStylesSource.slice(buttonRuleStart, buttonRuleEnd + 1);
    expect(buttonRuleStart).toBeGreaterThan(-1);
    expect(buttonRule).toContain('background: var(--secondary-container)');
    expect(buttonRule).toContain('min-height: 44px');
    expect(desktopStylesSource).toContain('.settings-stack input[type="file"]:focus-visible {');
  });
});
