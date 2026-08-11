import { describe, expect, it } from 'vitest';
import { evaluateSearch, MAX_PATTERN_LENGTH } from './search';

describe('evaluateSearch', () => {
  it('defaults to case-insensitive plain-text matching', () => {
    expect(evaluateSearch('tools', 'Material Tools', { regex: false, caseSensitive: false, multiline: false })).toEqual({ matched: true, error: null });
  });

  it('supports regular expressions and flags', () => {
    expect(evaluateSearch('^material', 'Material Tools', { regex: true, caseSensitive: false, multiline: false }).matched).toBe(true);
  });

  it('reports invalid patterns without throwing', () => {
    const result = evaluateSearch('[', 'value', { regex: true, caseSensitive: false, multiline: false });
    expect(result.matched).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('bounds pattern input', () => {
    const result = evaluateSearch('x'.repeat(MAX_PATTERN_LENGTH + 1), 'value', { regex: true, caseSensitive: false, multiline: false });
    expect(result.error).toContain(String(MAX_PATTERN_LENGTH));
  });
});
