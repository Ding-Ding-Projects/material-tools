export const PRIVATE_VOCABULARY_STORAGE_KEY = 'material-tools.private-vocabulary.v1';
export const PRIVATE_VOCABULARY_MAX_BYTES = 64 * 1024;
export const PRIVATE_VOCABULARY_MAX_ENTRIES_PER_SECTION = 500;
export const PRIVATE_VOCABULARY_MAX_NESTING_DEPTH = 2;
export const PRIVATE_VOCABULARY_MAX_KEY_LENGTH = 160;
export const PRIVATE_VOCABULARY_MAX_VALUE_LENGTH = 240;

export interface PrivateVocabularyFile {
  version: 1;
  replacements: Record<string, string>;
  required_phrases: Record<string, string>;
}

interface LegacyPrivateVocabularyEntry {
  original: string;
  replacement: string;
}

const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export function formatPrivateVocabularyReplacementCount(count: number): string {
  return count === 1
    ? '1 replacement is active locally.'
    : `${count} replacements are active locally.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasControlCharacters(value: string): boolean {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value);
}

function assertSafeJsonStructure(raw: string): void {
  let cursor = 0;

  const skipWhitespace = () => {
    while (/\s/u.test(raw[cursor] ?? '')) cursor += 1;
  };

  const scanString = (): string => {
    const start = cursor;
    cursor += 1;
    while (cursor < raw.length) {
      if (raw[cursor] === '\\') {
        cursor += 2;
        continue;
      }
      if (raw[cursor] === '"') {
        cursor += 1;
        return JSON.parse(raw.slice(start, cursor)) as string;
      }
      cursor += 1;
    }
    throw new Error('The selected file is not valid JSON.');
  };

  const scanValue = (depth: number): void => {
    skipWhitespace();
    const token = raw[cursor];
    if (token === '{') {
      if (depth + 1 > PRIVATE_VOCABULARY_MAX_NESTING_DEPTH) {
        throw new Error(`The JSON nesting depth exceeds ${PRIVATE_VOCABULARY_MAX_NESTING_DEPTH}.`);
      }
      cursor += 1;
      skipWhitespace();
      const keys = new Set<string>();
      if (raw[cursor] === '}') {
        cursor += 1;
        return;
      }
      while (cursor < raw.length) {
        skipWhitespace();
        if (raw[cursor] !== '"') throw new Error('The selected file is not valid JSON.');
        const key = scanString();
        if (keys.has(key)) throw new Error('A JSON object repeats a key.');
        keys.add(key);
        skipWhitespace();
        if (raw[cursor] !== ':') throw new Error('The selected file is not valid JSON.');
        cursor += 1;
        scanValue(depth + 1);
        skipWhitespace();
        if (raw[cursor] === '}') {
          cursor += 1;
          return;
        }
        if (raw[cursor] !== ',') throw new Error('The selected file is not valid JSON.');
        cursor += 1;
      }
      throw new Error('The selected file is not valid JSON.');
    }
    if (token === '[') {
      if (depth + 1 > PRIVATE_VOCABULARY_MAX_NESTING_DEPTH) {
        throw new Error(`The JSON nesting depth exceeds ${PRIVATE_VOCABULARY_MAX_NESTING_DEPTH}.`);
      }
      cursor += 1;
      skipWhitespace();
      if (raw[cursor] === ']') {
        cursor += 1;
        return;
      }
      while (cursor < raw.length) {
        scanValue(depth + 1);
        skipWhitespace();
        if (raw[cursor] === ']') {
          cursor += 1;
          return;
        }
        if (raw[cursor] !== ',') throw new Error('The selected file is not valid JSON.');
        cursor += 1;
      }
      throw new Error('The selected file is not valid JSON.');
    }
    if (token === '"') {
      scanString();
      return;
    }
    while (cursor < raw.length && !/[\s,}\]]/u.test(raw[cursor])) cursor += 1;
  };

  scanValue(0);
  skipWhitespace();
  if (cursor !== raw.length) throw new Error('The selected file is not valid JSON.');
}

function validateStringRecord(value: unknown, section: string): Record<string, string> {
  if (!isRecord(value)) throw new Error(`${section} must be a JSON object.`);
  const entries = Object.entries(value);
  if (entries.length > PRIVATE_VOCABULARY_MAX_ENTRIES_PER_SECTION) {
    throw new Error(`${section} is limited to ${PRIVATE_VOCABULARY_MAX_ENTRIES_PER_SECTION} entries.`);
  }
  const result: Record<string, string> = {};
  for (const [key, entry] of entries) {
    if (UNSAFE_OBJECT_KEYS.has(key)) throw new Error(`${section} contains an unsafe object key.`);
    if (key.length === 0 || key.length > PRIVATE_VOCABULARY_MAX_KEY_LENGTH || hasControlCharacters(key)) {
      throw new Error(`${section} contains an invalid key.`);
    }
    if (typeof entry !== 'string' || entry.length === 0 || entry.length > PRIVATE_VOCABULARY_MAX_VALUE_LENGTH || hasControlCharacters(entry)) {
      throw new Error(`${section} contains an invalid value.`);
    }
    result[key] = entry;
  }
  return result;
}

export function parsePrivateVocabulary(raw: string): PrivateVocabularyFile {
  if (new TextEncoder().encode(raw).byteLength > PRIVATE_VOCABULARY_MAX_BYTES) {
    throw new Error('The selected file is larger than 64 KiB.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }
  assertSafeJsonStructure(raw);

  if (!isRecord(parsed) || parsed.version !== 1) {
    throw new Error('The file must use private vocabulary schema version 1.');
  }
  const allowedKeys = new Set(['version', 'replacements', 'required_phrases']);
  if (Object.keys(parsed).some((key) => !allowedKeys.has(key))) {
    throw new Error('The file contains fields outside the version 1 schema.');
  }

  return {
    version: 1,
    replacements: validateStringRecord(parsed.replacements, 'replacements'),
    required_phrases: validateStringRecord(parsed.required_phrases, 'required_phrases'),
  };
}

function normalizeLegacyPrivateVocabulary(raw: string): PrivateVocabularyFile | null {
  if (new TextEncoder().encode(raw).byteLength > PRIVATE_VOCABULARY_MAX_BYTES) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.schemaVersion !== 1 || !Array.isArray(parsed.entries)) return null;
  if (Object.keys(parsed).some((key) => key !== 'schemaVersion' && key !== 'entries')) return null;
  if (parsed.entries.length === 0 || parsed.entries.length > PRIVATE_VOCABULARY_MAX_ENTRIES_PER_SECTION) return null;

  const normalizedEntries: LegacyPrivateVocabularyEntry[] = [];
  const originals = new Set<string>();
  for (const candidate of parsed.entries) {
    if (!isRecord(candidate) || Object.keys(candidate).some((key) => key !== 'original' && key !== 'replacement')) return null;
    const original = candidate.original;
    const replacement = candidate.replacement;
    if (typeof original !== 'string' || typeof replacement !== 'string') return null;
    if (
      original.length === 0
      || original.length > PRIVATE_VOCABULARY_MAX_KEY_LENGTH
      || replacement.length === 0
      || replacement.length > PRIVATE_VOCABULARY_MAX_VALUE_LENGTH
      || hasControlCharacters(original)
      || hasControlCharacters(replacement)
      || UNSAFE_OBJECT_KEYS.has(original)
      || originals.has(original)
    ) return null;
    originals.add(original);
    normalizedEntries.push({ original, replacement });
  }

  return {
    version: 1,
    replacements: Object.fromEntries(normalizedEntries.map(({ original, replacement }) => [original, replacement])),
    required_phrases: {},
  };
}

export function applyPrivateVocabulary(value: string, vocabulary: PrivateVocabularyFile | null): string {
  if (!vocabulary) return value;
  const replacements = new Map(Object.entries(vocabulary.replacements));
  if (replacements.size === 0) return value;
  const pattern = [...replacements.keys()]
    .sort((left, right) => right.length - left.length)
    .map((source) => source.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
    .join('|');
  return value.replace(new RegExp(pattern, 'gu'), (match) => replacements.get(match) ?? match);
}

export function loadPrivateVocabulary(
  storage: Pick<Storage, 'getItem'> & Partial<Pick<Storage, 'removeItem' | 'setItem'>> = localStorage,
): PrivateVocabularyFile | null {
  let stored: string | null;
  try {
    stored = storage.getItem(PRIVATE_VOCABULARY_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!stored) return null;
  try {
    return parsePrivateVocabulary(stored);
  } catch {
    const legacy = normalizeLegacyPrivateVocabulary(stored);
    if (legacy) {
      try {
        storage.setItem?.(PRIVATE_VOCABULARY_STORAGE_KEY, JSON.stringify(legacy));
      } catch {
        // The normalized document is safe to use for this session even when migration cannot persist.
      }
      return legacy;
    }
    try {
      const parsed = JSON.parse(stored) as unknown;
      if (isRecord(parsed) && parsed.schemaVersion === 1 && Array.isArray(parsed.entries)) return null;
    } catch {
      // Corrupt non-legacy cache values are removed below.
    }
    try {
      storage.removeItem?.(PRIVATE_VOCABULARY_STORAGE_KEY);
    } catch {
      // Corrupt storage remains recoverable; shipped wording is still the fail-safe result.
    }
    return null;
  }
}

export function persistPrivateVocabulary(
  vocabulary: PrivateVocabularyFile | null,
  storage: Pick<Storage, 'setItem' | 'removeItem'> = localStorage,
): void {
  if (vocabulary) storage.setItem(PRIVATE_VOCABULARY_STORAGE_KEY, JSON.stringify(vocabulary));
  else storage.removeItem(PRIVATE_VOCABULARY_STORAGE_KEY);
}
