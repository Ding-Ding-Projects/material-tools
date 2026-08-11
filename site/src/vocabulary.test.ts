import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyPrivateVocabulary,
  cachePrivateVocabulary,
  clearPrivateVocabulary,
  loadPrivateVocabulary,
  MAX_PRIVATE_VOCABULARY_BYTES,
  parsePrivateVocabulary,
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

  it('rejects invalid versions, fields, entry types, and oversized payloads', () => {
    expect(parsePrivateVocabulary('{')).toMatchObject({ document: null });
    expect(parsePrivateVocabulary(JSON.stringify({ ...valid, version: 2 }))).toMatchObject({ document: null });
    expect(parsePrivateVocabulary(JSON.stringify({ ...valid, extra: true }))).toMatchObject({ document: null });
    expect(parsePrivateVocabulary(JSON.stringify({ ...valid, replacements: { Alpha: 2 } }))).toMatchObject({ document: null });
    expect(parsePrivateVocabulary('x'.repeat(MAX_PRIVATE_VOCABULARY_BYTES + 1))).toMatchObject({ document: null });
  });

  it('keeps the validated document in a separate browser-local cache and clears it', () => {
    cachePrivateVocabulary(valid);
    expect(loadPrivateVocabulary()).toEqual(valid);
    clearPrivateVocabulary();
    expect(loadPrivateVocabulary()).toBeNull();
  });
});
