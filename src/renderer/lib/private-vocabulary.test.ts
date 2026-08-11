import { describe, expect, it } from 'vitest';
import {
  applyPrivateVocabulary,
  parsePrivateVocabulary,
  PRIVATE_VOCABULARY_MAX_BYTES,
} from './private-vocabulary';

describe('private vocabulary', () => {
  it('parses a bounded versioned file and applies longest literal matches once', () => {
    const vocabulary = parsePrivateVocabulary(JSON.stringify({
      schemaVersion: 1,
      entries: [
        { original: 'Settings', replacement: 'Preferences' },
        { original: 'Settings page', replacement: 'Preferences area' },
      ],
    }));

    expect(applyPrivateVocabulary('Open the Settings page from Settings.', vocabulary))
      .toBe('Open the Preferences area from Preferences.');
  });

  it.each([
    ['invalid JSON', '{'],
    ['wrong schema', JSON.stringify({ schemaVersion: 2, entries: [] })],
    ['empty entries', JSON.stringify({ schemaVersion: 1, entries: [] })],
    ['duplicate originals', JSON.stringify({ schemaVersion: 1, entries: [
      { original: 'A', replacement: 'B' },
      { original: 'A', replacement: 'C' },
    ] })],
  ])('rejects %s', (_label, raw) => {
    expect(() => parsePrivateVocabulary(raw)).toThrow();
  });

  it('rejects oversized input before parsing', () => {
    expect(() => parsePrivateVocabulary('x'.repeat(PRIVATE_VOCABULARY_MAX_BYTES + 1)))
      .toThrow('larger than 256 KiB');
  });

  it('leaves shipped wording unchanged when no file is loaded', () => {
    expect(applyPrivateVocabulary('Settings', null)).toBe('Settings');
  });
});
