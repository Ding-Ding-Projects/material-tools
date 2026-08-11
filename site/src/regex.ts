import type { SearchState } from './types';

export const MAX_PATTERN = 128;
export const MAX_SAMPLE = 512;

export interface PatternResult {
  valid: boolean;
  message: string;
  regex?: RegExp;
}

function hasUnsafeBacktrackingShape(pattern: string): boolean {
  if (/\\(?:[1-9]|k<)/.test(pattern)) return true;
  if (/\(\?(?!:)/.test(pattern)) return true;
  if (/(?:\.\*){2,}|(?:\.\+){2,}/.test(pattern)) return true;

  for (const match of pattern.matchAll(/\{(\d+)(?:,(\d*))?\}/g)) {
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
      if (next === '*' || next === '+' || next === '?' || next === '{') {
        if (group.risky) return true;
      }
      continue;
    }
    const isGroupSyntax = character === '?' && pattern[index - 1] === '(' && pattern[index + 1] === ':';
    if (!isGroupSyntax && (character === '*' || character === '+' || character === '?' || character === '{')) {
      quantifierCount += 1;
      if (quantifierCount > 1) return true;
      if (character === '{') {
        const close = pattern.indexOf('}', index + 1);
        if (close > index) index = close;
      }
    }
    if (character === '|' || (!isGroupSyntax && (character === '*' || character === '+' || character === '?' || character === '{'))) {
      for (const group of groups) group.risky = true;
    }
  }
  return false;
}

export function validatePattern(pattern: string, flags: string): PatternResult {
  if (!pattern) return { valid: true, message: 'Enter a pattern to preview matches.' };
  if (pattern.length > MAX_PATTERN) {
    return { valid: false, message: `Patterns are limited to ${MAX_PATTERN} characters.` };
  }
  if (hasUnsafeBacktrackingShape(pattern)) {
    return { valid: false, message: 'This pattern exceeds the linear-time subset used for responsive local search.' };
  }
  const safeFlags = [...new Set(flags.replace(/[^gimsuy]/g, '').split(''))].join('');
  try {
    return { valid: true, message: 'Pattern is valid.', regex: new RegExp(pattern, safeFlags) };
  } catch (error) {
    return { valid: false, message: error instanceof Error ? error.message : 'Pattern is invalid.' };
  }
}

export function matchesSearch(value: string, state: SearchState): boolean {
  if (!state.query) return true;
  if (state.query.length > MAX_PATTERN) return false;
  if (!state.regex) return value.toLocaleLowerCase().includes(state.query.toLocaleLowerCase());
  const result = validatePattern(state.query, state.flags);
  if (!result.valid || !result.regex) return false;
  result.regex.lastIndex = 0;
  return result.regex.test(value);
}

export function previewMatches(pattern: string, flags: string, sample: string): string[] {
  const result = validatePattern(pattern, flags.includes('g') ? flags : `${flags}g`);
  if (!result.valid || !result.regex) return [];
  const bounded = sample.slice(0, MAX_SAMPLE);
  const output: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = result.regex.exec(bounded)) && output.length < 25) {
    output.push(match.length > 1 ? `${match[0]} → ${match.slice(1).join(' | ')}` : match[0]);
    if (match[0] === '') result.regex.lastIndex += 1;
  }
  return output;
}
