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

  try {
    const flags = `${options.caseSensitive ? '' : 'i'}${options.multiline ? 'm' : ''}u`;
    return { matched: new RegExp(query, flags).test(text), error: null };
  } catch (error) {
    return { matched: false, error: error instanceof Error ? error.message : 'Invalid regular expression.' };
  }
}
