import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_SOURCE = readFileSync(fileURLToPath(new URL('../App.tsx', import.meta.url)), 'utf8');

function attributesFromTag(tag) {
  return new Map([...tag.matchAll(/([A-Za-z][\w-]*)=(?:"([^"]*)"|\{([^{}]*)\})/gu)]
    .map((match) => [match[1], match[2] ?? match[3]]));
}

describe('accent color editor completeness', () => {
  it('uses an in-app M3 editor and no finite native color input', () => {
    const nativeColorInputs = [...APP_SOURCE.matchAll(/<input\b[\s\S]*?\/>/gu)]
      .filter((match) => attributesFromTag(match[0]).get('type') === 'color');
    expect(nativeColorInputs).toHaveLength(0);
  });

  it('binds every hand-written search owner to its own adjacent full builder', () => {
    const expectedOwners = new Map([
      ['accent-color-controls', { query: 'query', options: 'options' }],
      ['command-palette', { query: 'query', options: 'options' }],
      ['current-tab-strip', { query: 'tabSearch', options: 'searchOptions' }],
    ]);
    const builders = [...APP_SOURCE.matchAll(/<AnchoredRegexBuilder\b[\s\S]*?\/>/gu)];
    expect(builders).toHaveLength(expectedOwners.size);

    for (const builder of builders) {
      const attributes = attributesFromTag(builder[0]);
      const owner = attributes.get('owner');
      const expected = expectedOwners.get(owner);
      expect(expected, `Unexpected regular expression builder owner: ${String(owner)}`).toBeDefined();
      expect(attributes.get('query')).toBe(expected.query);
      expect(attributes.get('onQueryChange')).toBe(expected.query === 'query' ? 'setQuery' : 'setTabSearch');
      expect(attributes.get('options')).toBe(expected.options);
      expect(attributes.get('onOptionsChange')).toBe(expected.options === 'options' ? 'setOptions' : 'setSearchOptions');
      expect(attributes.has('searchLabel')).toBe(true);
      expect(attributes.get('copy')).toBe('copy');
      expect(attributes.has('language')).toBe(true);

      const compositeStart = APP_SOURCE.lastIndexOf('<div className="search-composite', builder.index);
      const compositeEnd = APP_SOURCE.indexOf('</div>', builder.index);
      expect(compositeStart).toBeGreaterThanOrEqual(0);
      expect(compositeEnd).toBeGreaterThan(builder.index);
      const composite = APP_SOURCE.slice(compositeStart, compositeEnd);
      const inputs = [...composite.matchAll(/<input\b[\s\S]*?\/>/gu)];
      expect(inputs).toHaveLength(1);
      const inputAttributes = attributesFromTag(inputs[0][0]);
      expect(inputAttributes.get('type')).toBe('search');
      expect(inputAttributes.has('aria-label')).toBe(true);
      expect(inputAttributes.get('maxLength')).toBe('MAX_PATTERN_LENGTH');
    }
  });
});
