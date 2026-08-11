import { describe, expect, it } from 'vitest';
import { articles } from './catalog';
import { coverageInventory, requiredCoverageIds } from './coverage';

describe('hand-written coverage inventory', () => {
  it('contains every required core contract exactly once', () => {
    expect(new Set(requiredCoverageIds).size).toBe(requiredCoverageIds.length);
    expect(coverageInventory.map((item) => item.id).sort()).toEqual([...requiredCoverageIds].sort());
    expect(coverageInventory.every((item) => item.evidence.trim().length > 0)).toBe(true);
  });

  it('covers every upstream feature category with a cited article', () => {
    expect(articles.map((article) => article.id).sort()).toEqual(
      ['applications', 'automation', 'config', 'creator', 'tweaks', 'updates'],
    );
    for (const article of articles) {
      expect(article.sourcePath).toMatch(/^docs\/src\/content\/docs\/guides\//);
      expect(article.sourceUrl).toContain('ea5de27b6c66fe4f4a4c6513887d0fe5a1cd8bff');
      expect(article.capabilities.length).toBeGreaterThan(2);
    }
  });
});
