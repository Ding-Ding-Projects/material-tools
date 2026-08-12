import { describe, expect, it, vi } from 'vitest';
import {
  applyPrivateVocabulary,
  formatPrivateVocabularyReplacementCount,
  loadPrivateVocabulary,
  parsePrivateVocabulary,
  persistPrivateVocabulary,
  PRIVATE_VOCABULARY_MAX_BYTES,
  PRIVATE_VOCABULARY_MAX_ENTRIES_PER_SECTION,
  PRIVATE_VOCABULARY_MAX_KEY_LENGTH,
  PRIVATE_VOCABULARY_MAX_VALUE_LENGTH,
  PRIVATE_VOCABULARY_STORAGE_KEY,
} from './private-vocabulary';

const validVocabulary = {
  version: 1 as const,
  replacements: {
    Settings: 'Preferences',
    'Settings page': 'Preferences area',
  },
  required_phrases: { example: 'Settings' },
};

describe('private vocabulary', () => {
  it('parses the shared bounded contract and applies longest literal matches once', () => {
    const vocabulary = parsePrivateVocabulary(JSON.stringify(validVocabulary));

    expect(applyPrivateVocabulary('Open the Settings page from Settings.', vocabulary))
      .toBe('Open the Preferences area from Preferences.');
    expect(vocabulary.required_phrases).toEqual({ example: 'Settings' });
  });

  it('applies overlapping and chained replacements atomically without cascading', () => {
    const vocabulary = parsePrivateVocabulary(JSON.stringify({
      version: 1,
      replacements: { A: 'B', B: 'C', 'A B': 'Together' },
      required_phrases: {},
    }));
    expect(applyPrivateVocabulary('A B A', vocabulary)).toBe('Together B');
  });

  it.each([
    ['invalid JSON', '{'],
    ['wrong schema', JSON.stringify({ ...validVocabulary, version: 2 })],
    ['unexpected field', JSON.stringify({ ...validVocabulary, extra: true })],
    ['duplicate root key', '{"version":1,"version":1,"replacements":{},"required_phrases":{}}'],
    ['duplicate replacement key', '{"version":1,"replacements":{"Alpha":"Beta","Alpha":"Gamma"},"required_phrases":{}}'],
    ['unsafe object key', '{"version":1,"replacements":{"__proto__":"Beta"},"required_phrases":{}}'],
    ['excess nesting', '{"version":1,"replacements":{"Alpha":{"nested":"Beta"}},"required_phrases":{}}'],
    ['non-string replacement', JSON.stringify({ ...validVocabulary, replacements: { Alpha: 2 } })],
    ['missing required phrases', JSON.stringify({ version: 1, replacements: {} })],
  ])('rejects %s', (_label, raw) => {
    expect(() => parsePrivateVocabulary(raw)).toThrow();
  });

  it('enforces the shared file, count, key, and value bounds', () => {
    expect(() => parsePrivateVocabulary('x'.repeat(PRIVATE_VOCABULARY_MAX_BYTES + 1)))
      .toThrow('larger than 64 KiB');
    expect(() => parsePrivateVocabulary(JSON.stringify({
      version: 1,
      replacements: Object.fromEntries(Array.from({ length: PRIVATE_VOCABULARY_MAX_ENTRIES_PER_SECTION + 1 }, (_, index) => [`key-${index}`, 'value'])),
      required_phrases: {},
    }))).toThrow(/limited to/);
    expect(() => parsePrivateVocabulary(JSON.stringify({
      version: 1,
      replacements: { ['k'.repeat(PRIVATE_VOCABULARY_MAX_KEY_LENGTH + 1)]: 'value' },
      required_phrases: {},
    }))).toThrow(/invalid key/);
    expect(() => parsePrivateVocabulary(JSON.stringify({
      version: 1,
      replacements: { key: 'v'.repeat(PRIVATE_VOCABULARY_MAX_VALUE_LENGTH + 1) },
      required_phrases: {},
    }))).toThrow(/invalid value/);
  });

  it('leaves shipped wording unchanged when no file is loaded', () => {
    expect(applyPrivateVocabulary('Settings', null)).toBe('Settings');
  });

  it('drops a corrupt cached value and returns to original wording', () => {
    const removeItem = vi.fn();
    const storage = { getItem: () => '{', removeItem };
    expect(loadPrivateVocabulary(storage)).toBeNull();
    expect(removeItem).toHaveBeenCalledWith(PRIVATE_VOCABULARY_STORAGE_KEY);
  });

  it('migrates a compatible legacy version-one cache without losing its replacements', () => {
    const legacy = JSON.stringify({
      schemaVersion: 1,
      entries: [
        { original: 'Settings page', replacement: 'Preferences area' },
        { original: 'Settings', replacement: 'Preferences' },
      ],
    });
    const setItem = vi.fn();
    const removeItem = vi.fn();
    const migrated = loadPrivateVocabulary({ getItem: () => legacy, setItem, removeItem });

    expect(migrated).toEqual({
      version: 1,
      replacements: { 'Settings page': 'Preferences area', Settings: 'Preferences' },
      required_phrases: {},
    });
    expect(applyPrivateVocabulary('Open the Settings page from Settings.', migrated))
      .toBe('Open the Preferences area from Preferences.');
    expect(setItem).toHaveBeenCalledWith(PRIVATE_VOCABULARY_STORAGE_KEY, JSON.stringify(migrated));
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('uses a validated legacy cache for the session when migration storage is denied', () => {
    const legacy = JSON.stringify({
      schemaVersion: 1,
      entries: [{ original: 'Settings', replacement: 'Preferences' }],
    });
    const migrated = loadPrivateVocabulary({
      getItem: () => legacy,
      setItem: () => { throw new DOMException('storage denied'); },
      removeItem: vi.fn(),
    });
    expect(applyPrivateVocabulary('Settings', migrated)).toBe('Preferences');
  });

  it('preserves an incompatible legacy cache for manual recovery instead of deleting it', () => {
    const legacy = JSON.stringify({
      schemaVersion: 1,
      entries: Array.from({ length: PRIVATE_VOCABULARY_MAX_ENTRIES_PER_SECTION + 1 }, (_, index) => ({
        original: `source-${index}`,
        replacement: `replacement-${index}`,
      })),
    });
    const removeItem = vi.fn();
    expect(loadPrivateVocabulary({ getItem: () => legacy, removeItem })).toBeNull();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('persists only explicit vocabulary changes', () => {
    const setItem = vi.fn();
    const removeItem = vi.fn();
    const storage = { setItem, removeItem };

    persistPrivateVocabulary(validVocabulary, storage);
    expect(setItem).toHaveBeenCalledWith(PRIVATE_VOCABULARY_STORAGE_KEY, JSON.stringify(validVocabulary));
    expect(removeItem).not.toHaveBeenCalled();

    persistPrivateVocabulary(null, storage);
    expect(removeItem).toHaveBeenCalledWith(PRIVATE_VOCABULARY_STORAGE_KEY);
  });

  it('falls back without throwing when storage reads or corrupt-cache cleanup are denied', () => {
    expect(loadPrivateVocabulary({
      getItem: () => { throw new DOMException('read denied'); },
    })).toBeNull();
    expect(loadPrivateVocabulary({
      getItem: () => '{',
      removeItem: () => { throw new DOMException('cleanup denied'); },
    })).toBeNull();
  });

  it('uses truthful singular and plural replacement counts', () => {
    expect(formatPrivateVocabularyReplacementCount(1)).toBe('1 replacement is active locally.');
    expect(formatPrivateVocabularyReplacementCount(2)).toBe('2 replacements are active locally.');
  });
});
