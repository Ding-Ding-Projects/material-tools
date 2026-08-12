import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const captureSource = readFileSync(new URL('../../../scripts/capture-ui.mjs', import.meta.url), 'utf8');

describe('private-vocabulary capture harness privacy', () => {
  it('refuses a pre-existing cache before the first capture', () => {
    const runtimeEnabled = captureSource.indexOf("await send('Runtime.enable')");
    const cacheProbe = captureSource.indexOf("localStorage.getItem('material-tools.private-vocabulary.v1') === null");
    const firstPageWait = captureSource.indexOf("await waitFor(\"Boolean(document.querySelector('.fact-grid'))\"");
    const refusal = captureSource.indexOf('Capture refused: the selected profile already contains a private-vocabulary cache.');
    const firstCapture = captureSource.indexOf("await capture('overview-dark'");
    expect(cacheProbe).toBeGreaterThan(runtimeEnabled);
    expect(firstPageWait).toBeGreaterThan(cacheProbe);
    expect(refusal).toBeGreaterThan(-1);
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
});
