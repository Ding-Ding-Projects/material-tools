export const PRIVATE_VOCABULARY_KEY = 'material-tools.pages.private-vocabulary.v1';
export const PRIVATE_VOCABULARY_CHANGE_EVENT = 'material-tools-private-vocabulary-change';
export const MAX_PRIVATE_VOCABULARY_BYTES = 64 * 1024;
const MAX_ENTRIES_PER_SECTION = 500;
const MAX_ENTRY_KEY_LENGTH = 160;
const MAX_ENTRY_VALUE_LENGTH = 240;

export interface PrivateVocabularyDocument {
  version: 1;
  replacements: Record<string, string>;
  required_phrases: Record<string, string>;
}

export interface VocabularyParseResult {
  document: PrivateVocabularyDocument | null;
  error: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateStringRecord(value: unknown, section: string): { value: Record<string, string> | null; error: string | null } {
  if (!isRecord(value)) return { value: null, error: `${section} must be a JSON object.` };
  const entries = Object.entries(value);
  if (entries.length > MAX_ENTRIES_PER_SECTION) return { value: null, error: `${section} is limited to ${MAX_ENTRIES_PER_SECTION} entries.` };
  const result: Record<string, string> = {};
  for (const [key, entry] of entries) {
    if (key.length === 0 || key.length > MAX_ENTRY_KEY_LENGTH || typeof entry !== 'string' || entry.length === 0 || entry.length > MAX_ENTRY_VALUE_LENGTH) {
      return { value: null, error: `${section} contains an invalid key or value length.` };
    }
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(key) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(entry)) {
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
  try {
    const parsed: unknown = JSON.parse(raw);
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
  } catch {
    return { document: null, error: 'The selected file is not valid JSON.' };
  }
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

export function applyPrivateVocabulary(text: string, document: PrivateVocabularyDocument | null): string {
  if (!document) return text;
  return Object.entries(document.replacements)
    .sort(([first], [second]) => second.length - first.length)
    .reduce((output, [source, replacement]) => output.split(source).join(replacement), text);
}
