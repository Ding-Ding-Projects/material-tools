import { describe, expect, it } from 'vitest';
import { APPLICATION_CATALOG, APPLICATION_CATALOG_UPSTREAM } from '../../shared/application-catalog.generated';

describe('pinned WinUtil application catalog', () => {
  it('contains every application from the pinned upstream snapshot exactly once', () => {
    expect(APPLICATION_CATALOG).toHaveLength(227);
    expect(new Set(APPLICATION_CATALOG.map((item) => item.key)).size).toBe(227);
    expect(APPLICATION_CATALOG_UPSTREAM).toEqual({
      repository: 'ChrisTitusTech/winutil',
      ref: 'ea5de27b6c66fe4f4a4c6513887d0fe5a1cd8bff',
      path: 'config/applications.json',
      sha256: 'd72d66e0b57d3042c0a45dc1c11608abebfcc31ae8e11a14e62ad7bd2012c178',
    });
  });

  it('keeps every operation bound to parsed package identifiers rather than command text', () => {
    for (const item of APPLICATION_CATALOG) {
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
      expect(item.category.length).toBeGreaterThan(0);
      expect(item.link.startsWith('https://')).toBe(true);
      expect(item.winget.length + item.choco.length).toBeGreaterThan(0);
      for (const id of [...item.winget, ...item.choco]) {
        expect(id).toMatch(/^[A-Za-z0-9][A-Za-z0-9.+_:\-]*$/);
      }
    }
  });

  it('normalizes multi-package and Microsoft Store records without shell delimiters', () => {
    const desktopClient = APPLICATION_CATALOG.find((item) => item.key === 'githubdesktop');
    const storeClient = APPLICATION_CATALOG.find((item) => item.key === 'chatgpt');
    expect(desktopClient?.choco).toEqual(['git', 'github-desktop']);
    expect(storeClient?.winget).toEqual(['msstore:9NT1R1C2HH7J']);
  });
});
