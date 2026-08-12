import { useEffect, useMemo, useState } from 'react';
import { bestContrastingText, contrastRatio, hexToHsl, hslToHex, normalizeHex } from '../color';
import { matchesSearch } from '../regex';
import type { LanguageMode, SearchState } from '../types';
import { SearchBox } from './SearchBox';

interface ColorControlProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  language?: LanguageMode;
  schoolMode?: boolean;
  transform?: (text: string) => string;
}

export function ColorControl({ label, value, onChange, language = 'en', schoolMode = false, transform = (text) => text }: ColorControlProps) {
  const [search, setSearch] = useState<SearchState>({ query: '', regex: false, flags: 'i' });
  const [draft, setDraft] = useState(value);
  const normalized = normalizeHex(value) ?? '#6750a4';
  const hsl = useMemo(() => hexToHsl(normalized), [normalized]);
  const searchable = (source: string) => {
    const transformed = transform(source);
    return transformed === source ? source : `${source} ${transformed}`;
  };
  const visible = {
    hex: matchesSearch(searchable('HEX direct color value custom entry'), search),
    hsl: matchesSearch(searchable('Hue saturation lightness continuous spectrum HSL'), search),
    contrast: matchesSearch(searchable('Accessible contrast foreground text ratio'), search),
  };
  const visibleCount = Object.values(visible).filter(Boolean).length;
  const onColor = bestContrastingText(normalized);

  useEffect(() => setDraft(value), [value]);

  function updateHsl(patch: Partial<typeof hsl>) {
    onChange(hslToHex({ ...hsl, ...patch }));
  }

  return (
    <section className="color-control" aria-label={label}>
      <SearchBox label={`${label} editor`} state={search} onChange={setSearch} resultCount={visibleCount} compact language={language} schoolMode={schoolMode} />
      {visible.hex && (
        <label>
          HEX color
          <span className="color-control__hex-row">
            <span className="color-control__swatch" style={{ background: normalized, color: onColor }} aria-hidden="true">Aa</span>
            <input
              type="text"
              value={draft}
              maxLength={7}
              spellCheck={false}
              aria-invalid={normalizeHex(draft) === null}
              onChange={(event) => {
                const next = event.target.value;
                setDraft(next);
                const valid = normalizeHex(next);
                if (valid) onChange(valid);
              }}
            />
          </span>
          {normalizeHex(draft) === null && <small className="field-error">Use six hexadecimal digits, for example #6750a4.</small>}
        </label>
      )}
      {visible.hsl && (
        <fieldset className="color-control__sliders">
          <legend>Continuous HSL controls</legend>
          <label>Hue <output>{hsl.hue}°</output><input aria-label="Hue" type="range" min="0" max="359" value={hsl.hue} onChange={(event) => updateHsl({ hue: Number(event.target.value) })} /></label>
          <label>Saturation <output>{hsl.saturation}%</output><input aria-label="Saturation" type="range" min="0" max="100" value={hsl.saturation} onChange={(event) => updateHsl({ saturation: Number(event.target.value) })} /></label>
          <label>Lightness <output>{hsl.lightness}%</output><input aria-label="Lightness" type="range" min="0" max="100" value={hsl.lightness} onChange={(event) => updateHsl({ lightness: Number(event.target.value) })} /></label>
        </fieldset>
      )}
      {visible.contrast && (
        <p className="color-control__contrast">
          Automatic text: <strong>{onColor}</strong> · contrast {contrastRatio(normalized, onColor).toFixed(2)}:1
        </p>
      )}
      {visibleCount === 0 && <p className="empty-state">No color controls match this search.</p>}
    </section>
  );
}
