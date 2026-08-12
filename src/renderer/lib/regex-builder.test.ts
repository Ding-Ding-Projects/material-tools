import { describe, expect, it, vi } from 'vitest';
import { MAX_PATTERN_LENGTH, UNSAFE_REGEX_MESSAGE } from './search';
import {
  appendRegexToken,
  buildCharacterClass,
  createRegexExport,
  escapeRegexLiteral,
  evaluateRegexPreview,
  flagsForSearchOptions,
  formatRegexLiteral,
  MAX_REGEX_PREVIEW_MATCHES,
  MAX_REGEX_SAMPLE_LENGTH,
  parseRegexFlags,
} from './regex-builder';

describe('full regular expression builder behavior', () => {
  it('constructs escaped literals and valid character classes within the pattern bound', () => {
    expect(escapeRegexLiteral('file[1].txt')).toBe('file\\[1\\]\\.txt');
    expect(buildCharacterClass('A-Za-z')).toEqual({ token: '[A-Za-z]', error: null });
    expect(buildCharacterClass('')).toMatchObject({ token: null, error: expect.any(String) });
    expect(appendRegexToken('^file', '\\d+$')).toEqual({ pattern: '^file\\d+$', error: null });
    expect(appendRegexToken('x'.repeat(MAX_PATTERN_LENGTH), '+')).toEqual({
      pattern: 'x'.repeat(MAX_PATTERN_LENGTH),
      error: `Pattern must be ${MAX_PATTERN_LENGTH} characters or fewer.`,
    });
  });

  it('round-trips the raw i, m, and required Unicode flags into search options', () => {
    const options = { regex: true, caseSensitive: false, multiline: true };
    expect(flagsForSearchOptions(options)).toBe('imu');
    expect(parseRegexFlags('imu')).toEqual({ error: null, options });
    expect(parseRegexFlags('iiu')).toMatchObject({ options: null, error: expect.stringMatching(/repeated/) });
    expect(parseRegexFlags('gimu')).toMatchObject({ options: null, error: expect.stringMatching(/Unsupported/) });
    expect(parseRegexFlags('im')).toMatchObject({ options: null, error: expect.stringMatching(/Unicode/) });
  });

  it('reports syntax, live matches, indices, and capture groups', () => {
    const preview = evaluateRegexPreview('(Material) (Tools)', 'iu', 'Material Tools and material tools');
    expect(preview).toEqual({
      error: null,
      truncated: false,
      matches: [
        { index: 0, text: 'Material Tools', captures: ['Material', 'Tools'] },
        { index: 19, text: 'material tools', captures: ['material', 'tools'] },
      ],
    });
    expect(evaluateRegexPreview('[', 'iu', 'value')).toMatchObject({ matches: [], error: expect.any(String) });
  });

  it('terminates zero-width matches and bounds both sample size and preview results', () => {
    const zeroWidth = evaluateRegexPreview('^', 'mu', 'one\ntwo');
    expect(zeroWidth.matches.map((match) => match.index)).toEqual([0, 4]);

    const truncated = evaluateRegexPreview('.', 'u', 'x'.repeat(MAX_REGEX_PREVIEW_MATCHES + 2));
    expect(truncated.matches).toHaveLength(MAX_REGEX_PREVIEW_MATCHES);
    expect(truncated.truncated).toBe(true);

    expect(evaluateRegexPreview('.', 'u', 'x'.repeat(MAX_REGEX_SAMPLE_LENGTH + 1))).toMatchObject({
      matches: [],
      error: `Sample text must be ${MAX_REGEX_SAMPLE_LENGTH} characters or fewer.`,
    });
  });

  it('rejects catastrophic backtracking in the live preview before constructing a RegExp', () => {
    const NativeRegExp = globalThis.RegExp;
    const construct = vi.fn(function (this: unknown, pattern: string | RegExp, flags?: string) {
      return new NativeRegExp(pattern, flags);
    });
    vi.stubGlobal('RegExp', construct as unknown as RegExpConstructor);
    try {
      const preview = evaluateRegexPreview('(a+)+$', 'u', `${'a'.repeat(100)}!`);
      expect(preview).toEqual({ error: UNSAFE_REGEX_MESSAGE, matches: [], truncated: false });
      expect(construct).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('copies a JavaScript literal form and exports a versioned JSON document', () => {
    expect(formatRegexLiteral('a/b', 'iu')).toBe('/a\\/b/iu');
    const preview = evaluateRegexPreview('(a)', 'u', 'a');
    const exported = JSON.parse(createRegexExport('(a)', 'u', 'a', preview)) as Record<string, unknown>;
    expect(exported).toMatchObject({
      version: 1,
      engine: 'JavaScript RegExp',
      dialect: 'ECMAScript Unicode regular expression',
      pattern: '(a)',
      flags: 'u',
      sample: 'a',
      preview,
    });
  });
});
