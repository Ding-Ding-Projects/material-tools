import { describe, expect, it } from 'vitest';
import { isTrustedRendererNavigation } from '../../shared/navigation';

describe('isTrustedRendererNavigation', () => {
  const rendererUrl = 'file:///C:/Program%20Files/Material%20Tools/resources/app.asar/dist/renderer/index.html';

  it('allows the exact packaged renderer URL so reload remains usable', () => {
    expect(isTrustedRendererNavigation(rendererUrl, rendererUrl)).toBe(true);
  });

  it('rejects web navigation', () => {
    expect(isTrustedRendererNavigation('https://example.com/', rendererUrl)).toBe(false);
  });

  it('rejects sibling local files', () => {
    expect(isTrustedRendererNavigation('file:///C:/Program%20Files/Material%20Tools/resources/app.asar/other.html', rendererUrl)).toBe(false);
  });
});
