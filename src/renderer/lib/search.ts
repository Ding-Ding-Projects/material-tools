export interface SearchOptions {
  regex: boolean;
  caseSensitive: boolean;
  multiline: boolean;
}

export interface SearchResult {
  matched: boolean;
  error: string | null;
}

export const MAX_PATTERN_LENGTH = 256;
export const MAX_TEXT_LENGTH = 200_000;
export const UNSAFE_REGEX_MESSAGE = 'This pattern exceeds the linear-time subset used for responsive local search.';

export function hasUnsafeRegexShape(pattern: string): boolean {
  if (/\\(?:[1-9]|k<)/u.test(pattern)) return true;
  if (/\(\?(?!:)/u.test(pattern)) return true;
  if (/(?:\.\*){2,}|(?:\.\+){2,}/u.test(pattern)) return true;

  for (const match of pattern.matchAll(/\{(\d+)(?:,(\d*))?\}/gu)) {
    const lower = Number(match[1]);
    const upper = match[2] === undefined || match[2] === '' ? lower : Number(match[2]);
    if (lower > 100 || upper > 100) return true;
  }

  const groups: Array<{ risky: boolean }> = [];
  let escaped = false;
  let inClass = false;
  let quantifierCount = 0;
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (character === '[') {
      inClass = true;
      continue;
    }
    if (character === ']' && inClass) {
      inClass = false;
      continue;
    }
    if (inClass) continue;
    if (character === '(') {
      groups.push({ risky: false });
      continue;
    }
    if (character === ')') {
      const group = groups.pop();
      if (!group) continue;
      const next = pattern[index + 1] ?? '';
      if ((next === '*' || next === '+' || next === '?' || next === '{') && group.risky) return true;
      continue;
    }
    const isNonCapturingGroupPrefix = character === '?' && pattern[index - 1] === '(' && pattern[index + 1] === ':';
    const isQuantifier = !isNonCapturingGroupPrefix && (character === '*' || character === '+' || character === '?' || character === '{');
    if (isQuantifier) {
      quantifierCount += 1;
      if (quantifierCount > 1) return true;
      if (character === '{') {
        const close = pattern.indexOf('}', index + 1);
        if (close > index) index = close;
      }
    }
    if (character === '|' || isQuantifier) {
      for (const group of groups) group.risky = true;
    }
  }
  return false;
}

export function validateSafeRegexPattern(pattern: string): string | null {
  return hasUnsafeRegexShape(pattern) ? UNSAFE_REGEX_MESSAGE : null;
}

export function evaluateSearch(
  query: string,
  text: string,
  options: SearchOptions,
): SearchResult {
  if (!query) return { matched: true, error: null };
  if (query.length > MAX_PATTERN_LENGTH) {
    return { matched: false, error: `Pattern must be ${MAX_PATTERN_LENGTH} characters or fewer.` };
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return { matched: false, error: `Search text must be ${MAX_TEXT_LENGTH} characters or fewer.` };
  }
  if (!options.regex) {
    const source = options.caseSensitive ? text : text.toLocaleLowerCase();
    const needle = options.caseSensitive ? query : query.toLocaleLowerCase();
    return { matched: source.includes(needle), error: null };
  }

  const unsafeError = validateSafeRegexPattern(query);
  if (unsafeError) return { matched: false, error: unsafeError };

  try {
    const flags = `${options.caseSensitive ? '' : 'i'}${options.multiline ? 'm' : ''}u`;
    return { matched: new RegExp(query, flags).test(text), error: null };
  } catch (error) {
    return { matched: false, error: error instanceof Error ? error.message : 'Invalid regular expression.' };
  }
}
