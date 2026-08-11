import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { MAX_PATTERN, MAX_SAMPLE, previewMatches, validatePattern } from '../regex';
import type { SearchState } from '../types';

interface SearchBoxProps {
  label: string;
  state: SearchState;
  onChange: (state: SearchState) => void;
  resultCount?: number;
  placeholder?: string;
  compact?: boolean;
  autoFocus?: boolean;
}

const tokens = [
  { label: 'Literal', value: 'text' },
  { label: 'Class', value: '[A-Za-z]' },
  { label: 'Anchors', value: '^text$' },
  { label: 'Group', value: '(text)' },
  { label: 'Either', value: 'one|two' },
  { label: 'One or more', value: 'text+' },
];

export function SearchBox({ label, state, onChange, resultCount, placeholder, compact, autoFocus }: SearchBoxProps) {
  const id = useId();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [sample, setSample] = useState('Applications Tweaks Config Updates Win11 Creator');
  const builderButtonRef = useRef<HTMLButtonElement>(null);
  const builderRef = useRef<HTMLElement>(null);
  const validation = useMemo(
    () => (state.regex ? validatePattern(state.query, state.flags) : { valid: true, message: 'Plain-text mode is active.' }),
    [state],
  );
  const matches = useMemo(
    () => (state.regex && validation.valid ? previewMatches(state.query, state.flags, sample) : []),
    [sample, state, validation.valid],
  );

  function updateFlag(flag: string, enabled: boolean) {
    const next = enabled ? `${state.flags}${flag}` : state.flags.replace(flag, '');
    onChange({ ...state, flags: [...new Set(next.split(''))].sort().join('') });
  }

  async function copyPattern() {
    if (navigator.clipboard) await navigator.clipboard.writeText(state.query);
  }

  function closeBuilder() {
    setBuilderOpen(false);
    requestAnimationFrame(() => builderButtonRef.current?.focus());
  }

  useEffect(() => {
    if (builderOpen) builderRef.current?.querySelector<HTMLElement>('[data-builder-focus]')?.focus();
  }, [builderOpen]);

  return (
    <div className={`search-box ${compact ? 'search-box--compact' : ''}`}>
      <label htmlFor={`${id}-input`}>{label}</label>
      <div className="search-box__field">
        <input
          id={`${id}-input`}
          type="search"
          autoFocus={autoFocus}
          maxLength={MAX_PATTERN}
          value={state.query}
          placeholder={placeholder ?? `Search ${label.toLocaleLowerCase()}`}
          onChange={(event) => onChange({ ...state, query: event.target.value })}
          aria-invalid={state.regex && !validation.valid}
          aria-describedby={`${id}-status`}
        />
        <button
          ref={builderButtonRef}
          className={`icon-button regex-button ${state.regex ? 'is-active' : ''}`}
          type="button"
          aria-label={`Open anchored regex builder for ${label}`}
          aria-expanded={builderOpen}
          aria-controls={`${id}-builder`}
          onClick={() => builderOpen ? closeBuilder() : setBuilderOpen(true)}
        >
          {'{.*}'}
        </button>
      </div>
      <div id={`${id}-status`} className="search-box__status" aria-live="polite">
        {resultCount === undefined ? validation.message : `${resultCount} result${resultCount === 1 ? '' : 's'}`}
        {state.regex && !validation.valid ? ` — ${validation.message}` : ''}
      </div>
      {builderOpen && (
        <section
          ref={builderRef}
          id={`${id}-builder`}
          className="regex-builder"
          role="dialog"
          aria-label={`Regex builder for ${label}`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              closeBuilder();
            }
          }}
        >
          <div className="regex-builder__header">
            <div>
              <strong>Regex builder</strong>
              <span>JavaScript RegExp · local evaluation</span>
            </div>
            <button type="button" className="text-button" onClick={closeBuilder}>
              Close
            </button>
          </div>
          <label className="switch-row">
            <input
              data-builder-focus
              type="checkbox"
              checked={state.regex}
              onChange={(event) => onChange({ ...state, regex: event.target.checked })}
            />
            <span>Use regular expressions</span>
          </label>
          <label>
            Pattern
            <input
              maxLength={MAX_PATTERN}
              value={state.query}
              onChange={(event) => onChange({ ...state, query: event.target.value, regex: true })}
              spellCheck={false}
            />
          </label>
          <div className="token-grid" aria-label="Guided pattern parts">
            {tokens.map((token) => (
              <button
                key={token.label}
                type="button"
                onClick={() => onChange({ ...state, query: token.value, regex: true })}
              >
                {token.label}
              </button>
            ))}
          </div>
          <fieldset className="flag-row">
            <legend>Flags</legend>
            {['i', 'm', 's'].map((flag) => (
              <label key={flag}>
                <input
                  type="checkbox"
                  checked={state.flags.includes(flag)}
                  onChange={(event) => updateFlag(flag, event.target.checked)}
                />
                {flag}
              </label>
            ))}
          </fieldset>
          <label>
            Sample text
            <textarea value={sample} maxLength={MAX_SAMPLE} onChange={(event) => setSample(event.target.value)} />
          </label>
          <div className={`validation ${validation.valid ? 'is-valid' : 'is-invalid'}`} role="status">
            {validation.message}
          </div>
          <div className="regex-builder__preview">
            <strong>Live matches and captures</strong>
            {matches.length > 0 ? (
              <ol>{matches.map((match, index) => <li key={`${match}-${index}`}>{match || '(zero-width match)'}</li>)}</ol>
            ) : (
              <p>No matches in the current sample.</p>
            )}
          </div>
          <div className="button-row">
            <button type="button" className="tonal-button" onClick={copyPattern}>Copy pattern</button>
            <button type="button" className="text-button" onClick={() => onChange({ query: '', regex: false, flags: 'i' })}>
              Reset
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
