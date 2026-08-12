import { describe, expect, it, vi } from 'vitest';
import { evaluateSearch, MAX_PATTERN_LENGTH, UNSAFE_REGEX_MESSAGE } from './search';

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

  it('rejects a catastrophic backtracking shape before constructing a RegExp', () => {
    const NativeRegExp = globalThis.RegExp;
    const construct = vi.fn(function (this: unknown, pattern: string | RegExp, flags?: string) {
      return new NativeRegExp(pattern, flags);
    });
    vi.stubGlobal('RegExp', construct as unknown as RegExpConstructor);
    try {
      for (const pattern of ['(a+)+$', '^(a|aa)+$', '^(?:a?)+$', '^(a+)\\1$', 'a{1,1000}', '^a*a*a*a*a*a*a*a*a*b$']) {
        const result = evaluateSearch(pattern, `${'a'.repeat(100)}!`, { regex: true, caseSensitive: true, multiline: false });
        expect(result).toEqual({ matched: false, error: UNSAFE_REGEX_MESSAGE });
      }
      expect(construct).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
