import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AnchoredRegexBuilder } from './AnchoredRegexBuilder';

const REQUIRED_RENDERED_CONTROLS = [
  'close',
  'mode-regex',
  'mode-case-sensitive',
  'mode-multiline',
  'raw-flags',
  'raw-pattern',
  'guide-literal-input',
  'guide-literal-add',
  'guide-character-class-input',
  'guide-character-class-add',
  'guide-anchor-start',
  'guide-anchor-end',
  'guide-group',
  'guide-alternation',
  'guide-quantifier-optional',
  'guide-quantifier-zero-or-more',
  'guide-quantifier-one-or-more',
  'guide-quantifier-range',
  'sample-text',
  'syntax-feedback',
  'live-matches',
  'copy-pattern',
  'export-pattern',
] as const;

const identity = (value: string) => value;
const noChange = () => undefined;

function renderBuilder(query = '(Material) Tools', owner = 'component-test') {
  return renderToStaticMarkup(
    <AnchoredRegexBuilder
      owner={owner}
      searchLabel="Component test search"
      query={query}
      onQueryChange={noChange}
      options={{ regex: true, caseSensitive: false, multiline: false }}
      onOptionsChange={noChange}
      copy={identity}
      language="en"
    />,
  );
}

describe('AnchoredRegexBuilder component completeness', () => {
  it('renders the hand-written complete control inventory instead of a reduced mode panel', () => {
    const markup = renderBuilder();
    const renderedControls = [...markup.matchAll(/data-regex-control="([^"]+)"/gu)]
      .map((match) => match[1]);

    expect(renderedControls).toEqual(REQUIRED_RENDERED_CONTROLS);
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('JavaScript RegExp · Unicode');
    expect(markup).toContain('Guided construction');
    expect(markup).toContain('Sample and live results');
  });

  it('binds each rendered instance to its own owner, raw pattern, and flags', () => {
    const first = renderBuilder('^first$', 'first-search');
    const second = renderToStaticMarkup(
      <AnchoredRegexBuilder
        owner="second-search"
        searchLabel="Second search"
        query="(second)+"
        onQueryChange={noChange}
        options={{ regex: true, caseSensitive: true, multiline: true }}
        onOptionsChange={noChange}
        copy={identity}
        language="en"
      />,
    );

    expect(first).toContain('data-search-owner="first-search"');
    expect(first).toContain('^first$');
    expect(first).toContain('value="iu"');
    expect(second).toContain('data-search-owner="second-search"');
    expect(second).toContain('(second)+');
    expect(second).toContain('value="mu"');
  });

});
