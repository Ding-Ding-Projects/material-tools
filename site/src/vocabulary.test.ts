import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyPrivateVocabulary,
  cachePrivateVocabulary,
  clearPrivateVocabulary,
  createPrivateVocabularyTransform,
  loadPrivateVocabulary,
  MAX_PRIVATE_VOCABULARY_BYTES,
  MAX_PRIVATE_VOCABULARY_ENTRIES_PER_SECTION,
  MAX_PRIVATE_VOCABULARY_KEY_LENGTH,
  MAX_PRIVATE_VOCABULARY_VALUE_LENGTH,
  parsePrivateVocabulary,
  PRIVATE_VOCABULARY_KEY,
} from './vocabulary';

const valid = {
  version: 1 as const,
  replacements: { Alpha: 'Beta' },
  required_phrases: { example: 'Alpha' },
};

describe('private vocabulary boundary', () => {
  beforeEach(() => window.localStorage.clear());

  it('validates the bounded version-one schema without changing absent wording', () => {
    expect(parsePrivateVocabulary(JSON.stringify(valid))).toMatchObject({ error: null, document: valid });
    expect(applyPrivateVocabulary('Alpha remains original', null)).toBe('Alpha remains original');
    expect(applyPrivateVocabulary('Alpha changes locally', valid)).toBe('Beta changes locally');
  });

  it('applies overlapping and chained replacements atomically without cascading', () => {
    const vocabulary = {
      version: 1 as const,
      replacements: { A: 'B', B: 'C', 'A B': 'Together' },
      required_phrases: {},
    };
    const transform = createPrivateVocabularyTransform(vocabulary);
    expect(transform('A B A')).toBe('Together B');
    expect(transform('A B')).toBe('Together');
  });

  it('prepares one matcher for a document and reuses it across text-node values', () => {
    const NativeRegExp = globalThis.RegExp;
    const compileMatcher = vi.fn(function (this: unknown, pattern: string | RegExp, flags?: string) {
      return new NativeRegExp(pattern, flags);
    });
    vi.stubGlobal('RegExp', compileMatcher as unknown as RegExpConstructor);

    try {
      const vocabulary = {
        version: 1 as const,
        replacements: Object.fromEntries(Array.from(
          { length: MAX_PRIVATE_VOCABULARY_ENTRIES_PER_SECTION },
          (_, index) => [`source-${index}`, `replacement-${index}`],
        )),
        required_phrases: {},
      };
      const transform = createPrivateVocabularyTransform(vocabulary);
      expect(compileMatcher).toHaveBeenCalledTimes(1);

      for (let index = 0; index < 20; index += 1) {
        expect(transform(`node source-${index}`)).toBe(`node replacement-${index}`);
      }
      expect(compileMatcher).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejects invalid versions, fields, entry types, duplicate keys, unsafe keys, nesting, and oversized payloads', () => {
    expect(parsePrivateVocabulary('{')).toMatchObject({ document: null });
    expect(parsePrivateVocabulary(JSON.stringify({ ...valid, version: 2 }))).toMatchObject({ document: null });
    expect(parsePrivateVocabulary(JSON.stringify({ ...valid, extra: true }))).toMatchObject({ document: null });
    expect(parsePrivateVocabulary(JSON.stringify({ ...valid, replacements: { Alpha: 2 } }))).toMatchObject({ document: null });
    expect(parsePrivateVocabulary('{"version":1,"version":1,"replacements":{},"required_phrases":{}}')).toMatchObject({ document: null, error: 'A JSON object repeats a key.' });
    expect(parsePrivateVocabulary('{"version":1,"replacements":{"Alpha":"Beta","Alpha":"Gamma"},"required_phrases":{}}')).toMatchObject({ document: null, error: 'A JSON object repeats a key.' });
    expect(parsePrivateVocabulary('{"version":1,"replacements":{"__proto__":"Beta"},"required_phrases":{}}').error).toMatch(/unsafe object key/);
    expect(parsePrivateVocabulary('{"version":1,"replacements":{"Alpha":{"nested":"Beta"}},"required_phrases":{}}').error).toMatch(/nesting depth/);
    expect(parsePrivateVocabulary('x'.repeat(MAX_PRIVATE_VOCABULARY_BYTES + 1))).toMatchObject({ document: null });
  });

  it('enforces the shared count, key, and value bounds', () => {
    expect(parsePrivateVocabulary(JSON.stringify({
      ...valid,
      replacements: Object.fromEntries(Array.from({ length: MAX_PRIVATE_VOCABULARY_ENTRIES_PER_SECTION + 1 }, (_, index) => [`key-${index}`, 'value'])),
    }))).toMatchObject({ document: null, error: expect.stringMatching(/limited to/) });
    expect(parsePrivateVocabulary(JSON.stringify({
      ...valid,
      replacements: { ['k'.repeat(MAX_PRIVATE_VOCABULARY_KEY_LENGTH + 1)]: 'value' },
    }))).toMatchObject({ document: null, error: expect.stringMatching(/invalid key or value length/) });
    expect(parsePrivateVocabulary(JSON.stringify({
      ...valid,
      replacements: { key: 'v'.repeat(MAX_PRIVATE_VOCABULARY_VALUE_LENGTH + 1) },
    }))).toMatchObject({ document: null, error: expect.stringMatching(/invalid key or value length/) });
  });

  it('keeps the validated document in a separate browser-local cache and clears it', () => {
    cachePrivateVocabulary(valid);
    expect(loadPrivateVocabulary()).toEqual(valid);
    clearPrivateVocabulary();
    expect(loadPrivateVocabulary()).toBeNull();
  });

  it('purges a corrupt local cache and returns to original wording', () => {
    window.localStorage.setItem(PRIVATE_VOCABULARY_KEY, '{');
    expect(loadPrivateVocabulary()).toBeNull();
    expect(window.localStorage.getItem(PRIVATE_VOCABULARY_KEY)).toBeNull();
  });
});
