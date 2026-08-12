export const PRIVATE_VOCABULARY_KEY = 'material-tools.pages.private-vocabulary.v1';
export const PRIVATE_VOCABULARY_CHANGE_EVENT = 'material-tools-private-vocabulary-change';
export const MAX_PRIVATE_VOCABULARY_BYTES = 64 * 1024;
export const MAX_PRIVATE_VOCABULARY_ENTRIES_PER_SECTION = 500;
export const MAX_PRIVATE_VOCABULARY_NESTING_DEPTH = 2;
export const MAX_PRIVATE_VOCABULARY_KEY_LENGTH = 160;
export const MAX_PRIVATE_VOCABULARY_VALUE_LENGTH = 240;
const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export interface PrivateVocabularyDocument {
  version: 1;
  replacements: Record<string, string>;
  required_phrases: Record<string, string>;
}

export interface VocabularyParseResult {
  document: PrivateVocabularyDocument | null;
  error: string | null;
}

export type PrivateVocabularyTransform = (text: string) => string;

const identityPrivateVocabularyTransform: PrivateVocabularyTransform = (text) => text;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
      if (depth + 1 > MAX_PRIVATE_VOCABULARY_NESTING_DEPTH) {
        throw new Error(`The JSON nesting depth exceeds ${MAX_PRIVATE_VOCABULARY_NESTING_DEPTH}.`);
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
      if (depth + 1 > MAX_PRIVATE_VOCABULARY_NESTING_DEPTH) {
        throw new Error(`The JSON nesting depth exceeds ${MAX_PRIVATE_VOCABULARY_NESTING_DEPTH}.`);
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

function validateStringRecord(value: unknown, section: string): { value: Record<string, string> | null; error: string | null } {
  if (!isRecord(value)) return { value: null, error: `${section} must be a JSON object.` };
  const entries = Object.entries(value);
  if (entries.length > MAX_PRIVATE_VOCABULARY_ENTRIES_PER_SECTION) return { value: null, error: `${section} is limited to ${MAX_PRIVATE_VOCABULARY_ENTRIES_PER_SECTION} entries.` };
  const result: Record<string, string> = {};
  for (const [key, entry] of entries) {
    if (UNSAFE_OBJECT_KEYS.has(key)) return { value: null, error: `${section} contains an unsafe object key.` };
    if (key.length === 0 || key.length > MAX_PRIVATE_VOCABULARY_KEY_LENGTH || typeof entry !== 'string' || entry.length === 0 || entry.length > MAX_PRIVATE_VOCABULARY_VALUE_LENGTH) {
      return { value: null, error: `${section} contains an invalid key or value length.` };
    }
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(key) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(entry)) {
      return { value: null, error: `${section} contains unsupported control characters.` };
    }
    result[key] = entry;
  }
  return { value: result, error: null };
}

export function parsePrivateVocabulary(raw: string): VocabularyParseResult {
  if (new TextEncoder().encode(raw).byteLength > MAX_PRIVATE_VOCABULARY_BYTES) {
    return { document: null, error: 'The file is larger than the 64 KiB local limit.' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { document: null, error: 'The selected file is not valid JSON.' };
  }
  try {
    assertSafeJsonStructure(raw);
  } catch (error) {
    return { document: null, error: error instanceof Error ? error.message : 'The private vocabulary structure is invalid.' };
  }
  if (!isRecord(parsed) || parsed.version !== 1) return { document: null, error: 'Use private vocabulary schema version 1.' };
  const allowedKeys = new Set(['version', 'replacements', 'required_phrases']);
  if (Object.keys(parsed).some((key) => !allowedKeys.has(key))) {
    return { document: null, error: 'The file contains fields outside the version 1 schema.' };
  }
  const replacements = validateStringRecord(parsed.replacements, 'replacements');
  if (replacements.error || !replacements.value) return { document: null, error: replacements.error };
  const requiredPhrases = validateStringRecord(parsed.required_phrases, 'required_phrases');
  if (requiredPhrases.error || !requiredPhrases.value) return { document: null, error: requiredPhrases.error };
  return {
    document: { version: 1, replacements: replacements.value, required_phrases: requiredPhrases.value },
    error: null,
  };
}

export function loadPrivateVocabulary(): PrivateVocabularyDocument | null {
  try {
    const raw = window.localStorage.getItem(PRIVATE_VOCABULARY_KEY);
    if (!raw) return null;
    const parsed = parsePrivateVocabulary(raw);
    if (!parsed.document) window.localStorage.removeItem(PRIVATE_VOCABULARY_KEY);
    return parsed.document;
  } catch {
    return null;
  }
}

export function cachePrivateVocabulary(document: PrivateVocabularyDocument): void {
  window.localStorage.setItem(PRIVATE_VOCABULARY_KEY, JSON.stringify(document));
  window.dispatchEvent(new Event(PRIVATE_VOCABULARY_CHANGE_EVENT));
}

export function clearPrivateVocabulary(): void {
  window.localStorage.removeItem(PRIVATE_VOCABULARY_KEY);
  window.dispatchEvent(new Event(PRIVATE_VOCABULARY_CHANGE_EVENT));
}

export function createPrivateVocabularyTransform(document: PrivateVocabularyDocument | null): PrivateVocabularyTransform {
  if (!document) return identityPrivateVocabularyTransform;
  const replacements = new Map(Object.entries(document.replacements));
  if (replacements.size === 0) return identityPrivateVocabularyTransform;
  const pattern = [...replacements.keys()]
    .sort((first, second) => second.length - first.length)
    .map((source) => source.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
    .join('|');
  const matcher = new RegExp(pattern, 'gu');
  return (text) => text.replace(matcher, (match) => replacements.get(match) ?? match);
}

export function applyPrivateVocabulary(text: string, document: PrivateVocabularyDocument | null): string {
  return createPrivateVocabularyTransform(document)(text);
}
