import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ACTION_ILLUSTRATION_BINDINGS } from '../action-illustrations';
import {
  appendRegexToken,
  buildCharacterClass,
  createRegexExport,
  escapeRegexLiteral,
  evaluateRegexPreview,
  flagsForSearchOptions,
  formatRegexLiteral,
  MAX_REGEX_SAMPLE_LENGTH,
  parseRegexFlags,
  replaceRegexPattern,
} from '../lib/regex-builder';
import { MAX_PATTERN_LENGTH, type SearchOptions } from '../lib/search';
import type { FoundationSettings } from '../lib/settings';
import { ActionIllustration } from './ActionIllustration';

type LanguageMode = FoundationSettings['language'];

interface AnchoredRegexBuilderProps {
  owner: string;
  searchLabel: string;
  query: string;
  onQueryChange: (query: string) => void;
  options: SearchOptions;
  onOptionsChange: (options: SearchOptions) => void;
  copy: (value: string) => string;
  language: LanguageMode;
}

const DEFAULT_SAMPLE = 'Material Tools\nWindows setup\nSearch every destination';

export function AnchoredRegexBuilder({
  owner,
  searchLabel,
  query,
  onQueryChange,
  options,
  onOptionsChange,
  copy,
  language,
}: AnchoredRegexBuilderProps) {
  const baseId = useId();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const patternRef = useRef<HTMLTextAreaElement>(null);
  const [flagsDraft, setFlagsDraft] = useState(() => flagsForSearchOptions(options));
  const [sample, setSample] = useState(DEFAULT_SAMPLE);
  const [literalDraft, setLiteralDraft] = useState('text');
  const [classDraft, setClassDraft] = useState('A-Za-z');
  const [constructionError, setConstructionError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState('');

  useEffect(() => setFlagsDraft(flagsForSearchOptions(options)), [options.caseSensitive, options.multiline]);

  const parsedFlags = useMemo(() => parseRegexFlags(flagsDraft), [flagsDraft]);
  const preview = useMemo(() => evaluateRegexPreview(query, flagsDraft, sample), [flagsDraft, query, sample]);
  const feedback = constructionError ?? parsedFlags.error ?? preview.error;

  const setRegexPattern = (next: string) => {
    const result = replaceRegexPattern(query, next);
    setConstructionError(result.error);
    if (result.error) return;
    onQueryChange(result.pattern);
    if (!options.regex) onOptionsChange({ ...options, regex: true });
  };

  const addToken = (token: string) => {
    const result = appendRegexToken(query, token);
    setConstructionError(result.error);
    if (result.error) return;
    onQueryChange(result.pattern);
    if (!options.regex) onOptionsChange({ ...options, regex: true });
  };

  const closeBuilder = () => {
    if (detailsRef.current) detailsRef.current.open = false;
    summaryRef.current?.focus();
  };

  const copyPattern = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable.');
      await navigator.clipboard.writeText(formatRegexLiteral(query, flagsDraft));
      setActionStatus(copy('Regular expression copied.'));
    } catch (error) {
      setActionStatus(copy(error instanceof Error ? error.message : 'The regular expression could not be copied.'));
    }
  };

  const exportPattern = () => {
    const blob = new Blob([createRegexExport(query, flagsDraft, sample, preview)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'regular-expression.json';
    anchor.click();
    URL.revokeObjectURL(url);
    setActionStatus(copy('Regular expression exported as JSON.'));
  };

  return (
    <details
      ref={detailsRef}
      className="regex-builder"
      data-search-owner={owner}
      onToggle={(event) => {
        if (event.currentTarget.open) window.requestAnimationFrame(() => patternRef.current?.focus());
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && event.currentTarget.open) {
          event.preventDefault();
          closeBuilder();
        }
      }}
    >
      <summary ref={summaryRef} aria-label={copy(`Open anchored regular expression builder for ${searchLabel}`)}>.*</summary>
      <section className="popover-surface regex-builder__surface" role="dialog" aria-labelledby={`${baseId}-title`}>
        <header className="regex-builder__header">
          <div><p className="eyebrow">{copy('JavaScript RegExp · Unicode')}</p><h3 id={`${baseId}-title`}>{copy(`Regular expression builder for ${searchLabel}`)}</h3></div>
          <button type="button" className="icon-button" data-regex-control="close" aria-label={copy('Close regular expression builder')} onClick={closeBuilder}>×</button>
        </header>
        <ActionIllustration id={ACTION_ILLUSTRATION_BINDINGS.surfaces.regexBuilder} language={language} copy={copy} variant="popover" />

        <fieldset className="regex-builder__section regex-builder__mode">
          <legend>{copy('Search mode and flags')}</legend>
          <label><input data-regex-control="mode-regex" type="checkbox" checked={options.regex} onChange={(event) => onOptionsChange({ ...options, regex: event.target.checked })} /> {copy('Regular expression')}</label>
          <label><input data-regex-control="mode-case-sensitive" type="checkbox" checked={options.caseSensitive} onChange={(event) => onOptionsChange({ ...options, caseSensitive: event.target.checked })} /> {copy('Case sensitive')}</label>
          <label><input data-regex-control="mode-multiline" type="checkbox" checked={options.multiline} disabled={!options.regex} onChange={(event) => onOptionsChange({ ...options, multiline: event.target.checked })} /> {copy('Multiline anchors')}</label>
          <label className="regex-builder__flags">{copy('Raw flags')}
            <input
              data-regex-control="raw-flags"
              value={flagsDraft}
              maxLength={4}
              spellCheck={false}
              aria-describedby={`${baseId}-flag-help ${baseId}-feedback`}
              aria-invalid={Boolean(parsedFlags.error)}
              onChange={(event) => {
                const next = event.target.value.toLocaleLowerCase();
                setFlagsDraft(next);
                const parsed = parseRegexFlags(next);
                if (parsed.options) onOptionsChange(parsed.options);
              }}
            />
          </label>
          <small id={`${baseId}-flag-help`}>{copy('Supported flags: i for case-insensitive matching, m for multiline anchors, and required u for Unicode.')}</small>
        </fieldset>

        <fieldset className="regex-builder__section">
          <legend>{copy('Raw pattern')}</legend>
          <label>{copy('JavaScript regular expression pattern')}
            <textarea
              ref={patternRef}
              data-regex-control="raw-pattern"
              value={query}
              rows={3}
              maxLength={MAX_PATTERN_LENGTH}
              spellCheck={false}
              aria-describedby={`${baseId}-feedback`}
              aria-invalid={Boolean(feedback)}
              onChange={(event) => setRegexPattern(event.target.value)}
            />
          </label>
          <small>{copy(`${query.length} of ${MAX_PATTERN_LENGTH} pattern characters`)}</small>
          <small>{copy('Escaping follows the JavaScript RegExp dialect. Backreferences, lookarounds, nested or ambiguous quantifiers, and oversized repetition ranges are rejected before evaluation.')}</small>
        </fieldset>

        <fieldset className="regex-builder__section">
          <legend>{copy('Guided construction')}</legend>
          <div className="regex-builder__guided-grid">
            <div className="regex-builder__guide">
              <label>{copy('Literal text')}<input data-regex-control="guide-literal-input" value={literalDraft} maxLength={64} onChange={(event) => setLiteralDraft(event.target.value)} /></label>
              <button type="button" data-regex-control="guide-literal-add" onClick={() => addToken(escapeRegexLiteral(literalDraft))}>{copy('Add escaped literal')}</button>
            </div>
            <div className="regex-builder__guide">
              <label>{copy('Character class content')}<input data-regex-control="guide-character-class-input" value={classDraft} maxLength={64} spellCheck={false} onChange={(event) => setClassDraft(event.target.value)} /></label>
              <button type="button" data-regex-control="guide-character-class-add" onClick={() => {
                const result = buildCharacterClass(classDraft);
                setConstructionError(result.error);
                if (result.token) addToken(result.token);
              }}>{copy('Add character class')}</button>
            </div>
          </div>
          <div className="regex-builder__token-groups">
            <div role="group" aria-label={copy('Anchor tokens')}>
              <button type="button" data-regex-control="guide-anchor-start" onClick={() => setRegexPattern(query.startsWith('^') ? query : `^${query}`)}>{copy('Start anchor ^')}</button>
              <button type="button" data-regex-control="guide-anchor-end" onClick={() => setRegexPattern(query.endsWith('$') ? query : `${query}$`)}>{copy('End anchor $')}</button>
            </div>
            <div role="group" aria-label={copy('Group and alternation tokens')}>
              <button type="button" data-regex-control="guide-group" onClick={() => setRegexPattern(`(${query})`)}>{copy('Wrap in group ( )')}</button>
              <button type="button" data-regex-control="guide-alternation" onClick={() => addToken('|')}>{copy('Alternation |')}</button>
            </div>
            <div role="group" aria-label={copy('Quantifier tokens')}>
              <button type="button" data-regex-control="guide-quantifier-optional" onClick={() => addToken('?')}>?</button>
              <button type="button" data-regex-control="guide-quantifier-zero-or-more" onClick={() => addToken('*')}>*</button>
              <button type="button" data-regex-control="guide-quantifier-one-or-more" onClick={() => addToken('+')}>+</button>
              <button type="button" data-regex-control="guide-quantifier-range" onClick={() => addToken('{1,3}')}>{'{1,3}'}</button>
            </div>
          </div>
        </fieldset>

        <fieldset className="regex-builder__section">
          <legend>{copy('Sample and live results')}</legend>
          <label>{copy('Bounded sample text')}
            <textarea data-regex-control="sample-text" value={sample} rows={5} maxLength={MAX_REGEX_SAMPLE_LENGTH} onChange={(event) => setSample(event.target.value)} />
          </label>
          <small>{copy(`${sample.length} of ${MAX_REGEX_SAMPLE_LENGTH} sample characters`)}</small>
          <p
            id={`${baseId}-feedback`}
            data-regex-control="syntax-feedback"
            className={feedback ? 'regex-builder__feedback error' : 'regex-builder__feedback'}
            role={feedback ? 'alert' : 'status'}
          >
            {copy(feedback ?? (query ? 'Pattern syntax is valid.' : 'Enter a pattern or use a guided control.'))}
          </p>
          <div data-regex-control="live-matches" className="regex-builder__matches" aria-live="polite">
            <strong>{copy(`${preview.matches.length} live matches${preview.truncated ? ' (first 50 shown)' : ''}`)}</strong>
            {preview.matches.length === 0 && !feedback && <p>{copy('No sample matches.')}</p>}
            {preview.matches.length > 0 && (
              <ol>
                {preview.matches.map((match, index) => (
                  <li key={`${match.index}-${index}`}>
                    <code>{match.text || copy('Empty match')}</code> {copy(`at index ${match.index}`)}
                    {match.captures.length > 0
                      ? <ul>{match.captures.map((capture, captureIndex) => <li key={captureIndex}>{copy(`Capture ${captureIndex + 1}: ${capture ?? 'not matched'}`)}</li>)}</ul>
                      : <small>{copy('No capture groups in this match.')}</small>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </fieldset>

        <footer className="regex-builder__actions">
          <button type="button" data-regex-control="copy-pattern" disabled={Boolean(feedback)} onClick={() => { void copyPattern(); }}>{copy('Copy expression')}</button>
          <button type="button" data-regex-control="export-pattern" disabled={Boolean(feedback)} onClick={exportPattern}>{copy('Export JSON')}</button>
          <output aria-live="polite">{actionStatus}</output>
        </footer>
      </section>
    </details>
  );
}
