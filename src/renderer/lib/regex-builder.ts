import { MAX_PATTERN_LENGTH, validateSafeRegexPattern, type SearchOptions } from './search';

export const MAX_REGEX_SAMPLE_LENGTH = 4_000;
export const MAX_REGEX_PREVIEW_MATCHES = 50;

export interface RegexPreviewMatch {
  index: number;
  text: string;
  captures: Array<string | null>;
}

export interface RegexPreviewResult {
  error: string | null;
  matches: RegexPreviewMatch[];
  truncated: boolean;
}

export interface ParsedRegexFlags {
  error: string | null;
  options: SearchOptions | null;
}

export function flagsForSearchOptions(options: SearchOptions): string {
  return `${options.caseSensitive ? '' : 'i'}${options.multiline ? 'm' : ''}u`;
}

export function parseRegexFlags(flags: string): ParsedRegexFlags {
  const normalized = flags.toLocaleLowerCase();
  const unsupported = [...normalized].find((flag) => !['i', 'm', 'u'].includes(flag));
  if (unsupported) return { error: `Unsupported regular expression flag: ${unsupported}. Use i, m, and u only.`, options: null };
  if (new Set(normalized).size !== normalized.length) return { error: 'Regular expression flags cannot be repeated.', options: null };
  if (!normalized.includes('u')) return { error: 'The Unicode flag u is required by this search engine.', options: null };
  return {
    error: null,
    options: {
      regex: true,
      caseSensitive: !normalized.includes('i'),
      multiline: normalized.includes('m'),
    },
  };
}

export function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

export function buildCharacterClass(content: string): { token: string | null; error: string | null } {
  if (!content) return { token: null, error: 'Enter character-class content before adding it.' };
  const token = `[${content}]`;
  try {
    new RegExp(token, 'u');
    return { token, error: null };
  } catch (error) {
    return { token: null, error: error instanceof Error ? error.message : 'Invalid character class.' };
  }
}

export function appendRegexToken(pattern: string, token: string): { pattern: string; error: string | null } {
  if (pattern.length + token.length > MAX_PATTERN_LENGTH) {
    return { pattern, error: `Pattern must be ${MAX_PATTERN_LENGTH} characters or fewer.` };
  }
  return { pattern: `${pattern}${token}`, error: null };
}

export function replaceRegexPattern(pattern: string, next: string): { pattern: string; error: string | null } {
  if (next.length > MAX_PATTERN_LENGTH) {
    return { pattern, error: `Pattern must be ${MAX_PATTERN_LENGTH} characters or fewer.` };
  }
  return { pattern: next, error: null };
}

export function evaluateRegexPreview(pattern: string, flags: string, sample: string): RegexPreviewResult {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return { error: `Pattern must be ${MAX_PATTERN_LENGTH} characters or fewer.`, matches: [], truncated: false };
  }
  if (sample.length > MAX_REGEX_SAMPLE_LENGTH) {
    return { error: `Sample text must be ${MAX_REGEX_SAMPLE_LENGTH} characters or fewer.`, matches: [], truncated: false };
  }
  const parsedFlags = parseRegexFlags(flags);
  if (parsedFlags.error) return { error: parsedFlags.error, matches: [], truncated: false };
  if (!pattern) return { error: null, matches: [], truncated: false };
  const unsafeError = validateSafeRegexPattern(pattern);
  if (unsafeError) return { error: unsafeError, matches: [], truncated: false };

  try {
    const matcher = new RegExp(pattern, `g${flags.toLocaleLowerCase()}`);
    const matches: RegexPreviewMatch[] = [];
    let match: RegExpExecArray | null;
    while ((match = matcher.exec(sample)) !== null) {
      if (matches.length === MAX_REGEX_PREVIEW_MATCHES) {
        return { error: null, matches, truncated: true };
      }
      matches.push({
        index: match.index,
        text: match[0],
        captures: match.slice(1).map((capture) => capture ?? null),
      });
      if (match[0] === '') {
        const codePoint = sample.codePointAt(matcher.lastIndex);
        matcher.lastIndex += codePoint !== undefined && codePoint > 0xffff ? 2 : 1;
      }
    }
    return { error: null, matches, truncated: false };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Invalid regular expression.',
      matches: [],
      truncated: false,
    };
  }
}

export function formatRegexLiteral(pattern: string, flags: string): string {
  return `/${pattern.replaceAll('/', '\\/')}/${flags}`;
}

export function createRegexExport(
  pattern: string,
  flags: string,
  sample: string,
  preview: RegexPreviewResult,
): string {
  return `${JSON.stringify({
    version: 1,
    engine: 'JavaScript RegExp',
    dialect: 'ECMAScript Unicode regular expression',
    pattern,
    flags,
    sample,
    preview,
  }, null, 2)}\n`;
}
