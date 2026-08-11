export const PRIVATE_VOCABULARY_STORAGE_KEY = 'material-tools.private-vocabulary.v1';
export const PRIVATE_VOCABULARY_MAX_BYTES = 256 * 1024;
export const PRIVATE_VOCABULARY_MAX_ENTRIES = 512;

export interface PrivateVocabularyEntry {
  original: string;
  replacement: string;
}

export interface PrivateVocabularyFile {
  schemaVersion: 1;
  entries: PrivateVocabularyEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasControlCharacters(value: string): boolean {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value);
}

export function parsePrivateVocabulary(raw: string): PrivateVocabularyFile {
  if (new TextEncoder().encode(raw).byteLength > PRIVATE_VOCABULARY_MAX_BYTES) {
    throw new Error('The selected file is larger than 256 KiB.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }

  if (!isRecord(parsed) || parsed.schemaVersion !== 1 || !Array.isArray(parsed.entries)) {
    throw new Error('The file must use schemaVersion 1 and contain an entries array.');
  }
  if (parsed.entries.length === 0 || parsed.entries.length > PRIVATE_VOCABULARY_MAX_ENTRIES) {
    throw new Error(`The entries array must contain 1 to ${PRIVATE_VOCABULARY_MAX_ENTRIES} replacements.`);
  }

  const originals = new Set<string>();
  const entries = parsed.entries.map((candidate, index): PrivateVocabularyEntry => {
    if (!isRecord(candidate) || typeof candidate.original !== 'string' || typeof candidate.replacement !== 'string') {
      throw new Error(`Entry ${index + 1} must contain original and replacement strings.`);
    }
    const { original, replacement } = candidate;
    if (!original.trim() || original.length > 80 || hasControlCharacters(original)) {
      throw new Error(`Entry ${index + 1} has an invalid original value.`);
    }
    if (!replacement.trim() || replacement.length > 160 || hasControlCharacters(replacement)) {
      throw new Error(`Entry ${index + 1} has an invalid replacement value.`);
    }
    if (originals.has(original)) throw new Error(`Entry ${index + 1} repeats an original value.`);
    originals.add(original);
    return { original, replacement };
  });

  return { schemaVersion: 1, entries };
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

export function applyPrivateVocabulary(value: string, vocabulary: PrivateVocabularyFile | null): string {
  if (!vocabulary || vocabulary.entries.length === 0) return value;
  const replacements = new Map(vocabulary.entries.map((entry) => [entry.original, entry.replacement]));
  const alternatives = [...replacements.keys()]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegularExpression)
    .join('|');
  return value.replace(new RegExp(alternatives, 'gu'), (match) => replacements.get(match) ?? match);
}

export function loadPrivateVocabulary(storage: Pick<Storage, 'getItem'> = localStorage): PrivateVocabularyFile | null {
  const stored = storage.getItem(PRIVATE_VOCABULARY_STORAGE_KEY);
  if (!stored) return null;
  try {
    return parsePrivateVocabulary(stored);
  } catch {
    return null;
  }
}
