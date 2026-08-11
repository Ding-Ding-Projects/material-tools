/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import html from '../index.html?raw';

const modules = import.meta.glob(['./**/*.ts', './**/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('local-only runtime boundary', () => {
  it('contains no automatic network client in application source', () => {
    const source = Object.entries(modules)
      .filter(([path]) => !path.includes('.test.'))
      .map(([, value]) => value)
      .join('\n');
    for (const forbidden of [/\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\s*\(/, /\bsendBeacon\s*\(/, /\bEventSource\s*\(/]) {
      expect(source).not.toMatch(forbidden);
    }
  });

  it('loads no runtime scripts, styles, or fonts from a third-party origin', () => {
    expect(html).not.toMatch(/<(?:script|link)[^>]+(?:src|href)=["']https?:\/\//i);
  });

  it('keeps private vocabulary payloads out of network, logs, prompts, and shared state', () => {
    const vocabularySource = Object.entries(modules)
      .filter(([path]) => path.includes('vocabulary') || path.includes('PrivateVocabularyControl'))
      .map(([, value]) => value)
      .join('\n');
    expect(vocabularySource).not.toMatch(/\b(?:fetch|sendBeacon|prompt)\s*\(/);
    expect(vocabularySource).not.toMatch(/\b(?:XMLHttpRequest|WebSocket|EventSource)\b/);
    expect(vocabularySource).not.toMatch(/\bconsole\s*\./);
    expect(vocabularySource).not.toContain('file.name');
    expect(vocabularySource).not.toContain("from './storage'");
    expect(vocabularySource).not.toContain("from '../storage'");
  });
});
