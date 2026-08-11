import { describe, expect, it } from 'vitest';
import { matchesSearch, previewMatches, validatePattern } from './regex';

describe('regex search', () => {
  it('keeps plain text as the default behavior', () => {
    expect(matchesSearch('Config & Fixes', { query: 'fix', regex: false, flags: 'i' })).toBe(true);
    expect(matchesSearch('Updates', { query: 'fix', regex: false, flags: 'i' })).toBe(false);
  });

  it('supports flags, capture groups, and live previews', () => {
    expect(matchesSearch('Win11 Creator', { query: '^win(\\d+)', regex: true, flags: 'i' })).toBe(true);
    expect(previewMatches('(Win)(11)', 'i', 'Open Win11 Creator')).toEqual(['Win11 → Win | 11']);
  });

  it('reports invalid and backtracking-shaped patterns without throwing', () => {
    expect(validatePattern('[', 'i').valid).toBe(false);
    expect(validatePattern('(a+)+', 'i')).toMatchObject({ valid: false });
    expect(matchesSearch('aaaa', { query: '(a+)+', regex: true, flags: 'i' })).toBe(false);
    expect(validatePattern('^(a|aa)+$', 'i')).toMatchObject({ valid: false });
    expect(validatePattern('^(?:a?)+$', 'i')).toMatchObject({ valid: false });
    expect(validatePattern('^(a+)\\1$', 'i')).toMatchObject({ valid: false });
    expect(validatePattern('a{1,1000}', 'i')).toMatchObject({ valid: false });
    expect(validatePattern('^a*a*a*a*a*a*a*a*a*b$', 'i')).toMatchObject({ valid: false });
  });

  it('keeps bounded groups, alternation, Unicode, and multiline anchors available', () => {
    expect(validatePattern('^(Apps|Tweaks)$', 'im')).toMatchObject({ valid: true });
    expect(validatePattern('^(?:Win)11$', 'i')).toMatchObject({ valid: true });
    expect(matchesSearch('蝦餃', { query: '^蝦餃$', regex: true, flags: 'i' })).toBe(true);
  });

  it('handles zero-width matches without looping forever', () => {
    expect(previewMatches('^', 'm', 'one\ntwo')).toHaveLength(2);
  });
});
