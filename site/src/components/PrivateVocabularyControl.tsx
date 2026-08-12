import { type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  cachePrivateVocabulary,
  clearPrivateVocabulary,
  loadPrivateVocabulary,
  MAX_PRIVATE_VOCABULARY_BYTES,
  parsePrivateVocabulary,
  PRIVATE_VOCABULARY_CHANGE_EVENT,
  type PrivateVocabularyDocument,
} from '../vocabulary';
import type { LanguageMode } from '../types';
import { ActionIllustration } from './ActionIllustration';

const PREVIEW_SOURCE = 'Windows setup, mapped.';

interface PrivateVocabularyControlProps {
  compact?: boolean;
  language?: LanguageMode;
  schoolMode?: boolean;
}

interface LocalizedFailure {
  english: string;
  cantonese: string;
}

export function PrivateVocabularyControl({ compact = false, language = 'en', schoolMode = false }: PrivateVocabularyControlProps) {
  const [document, setDocument] = useState<PrivateVocabularyDocument | null>(() => loadPrivateVocabulary());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<LocalizedFailure | null>(null);
  const [compactOpen, setCompactOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const compactTriggerRef = useRef<HTMLButtonElement>(null);
  const compactPanelRef = useRef<HTMLDivElement>(null);
  const compactWasOpenRef = useRef(false);
  const activeLanguage = schoolMode ? 'en' : language;
  const text = (english: string, cantonese: string) => activeLanguage === 'yue' ? cantonese : activeLanguage === 'both' ? `${english} · ${cantonese}` : english;
  const visibleError = error ? text(error.english, error.cantonese) : null;

  useEffect(() => {
    const synchronize = () => setDocument(loadPrivateVocabulary());
    window.addEventListener(PRIVATE_VOCABULARY_CHANGE_EVENT, synchronize);
    return () => window.removeEventListener(PRIVATE_VOCABULARY_CHANGE_EVENT, synchronize);
  }, []);

  useLayoutEffect(() => {
    if (compactOpen) inputRef.current?.focus();
    else if (compactWasOpenRef.current) compactTriggerRef.current?.focus();
    compactWasOpenRef.current = compactOpen;
  }, [compactOpen]);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setMessage(null);
    setError(null);
    if (!file) return;
    try {
      if (file.size > MAX_PRIVATE_VOCABULARY_BYTES) {
        setError({
          english: 'The file is larger than the 64 KiB local limit.',
          cantonese: '檔案大過 64 KiB 本機上限。',
        });
        return;
      }
      const parsed = parsePrivateVocabulary(await file.text());
      if (!parsed.document) {
        setError({
          english: parsed.error ?? 'The private vocabulary file could not be validated.',
          cantonese: '檔案未能通過版本、格式或者大小驗證。',
        });
        return;
      }
      cachePrivateVocabulary(parsed.document);
      setDocument(parsed.document);
      const replacementCount = Object.keys(parsed.document.replacements).length;
      setMessage(text(
        `Loaded ${replacementCount} replacement ${replacementCount === 1 ? 'entry' : 'entries'} into this browser only.`,
        `已將 ${replacementCount} 個替換項目只載入到呢個瀏覽器。`,
      ));
    } catch {
      setError({
        english: 'The file could not be read and cached in this browser. The previous local vocabulary remains active.',
        cantonese: '呢個瀏覽器未能讀取同快取檔案。之前嘅本機詞彙仍然生效。',
      });
    } finally {
      event.target.value = '';
    }
  }

  function clear() {
    try {
      clearPrivateVocabulary();
      setDocument(null);
      setError(null);
      setMessage(text('The local private vocabulary cache was cleared. Original wording is active.', '本機私人詞彙快取已清除，而家使用原本文案。'));
      if (inputRef.current) inputRef.current.value = '';
    } catch {
      setMessage(null);
      setError({
        english: 'The local private vocabulary cache could not be cleared. The current wording remains active.',
        cantonese: '未能清除本機私人詞彙快取。現有文案仍然生效。',
      });
    }
  }

  function closeCompact() {
    setCompactOpen(false);
  }

  function onCompactKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeCompact();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...(compactPanelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])') ?? [])];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && globalThis.document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && globalThis.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (compact) {
    const status = visibleError ?? (document ? text('Loaded locally', '只喺本機載入') : text('Original wording', '使用原本文案'));
    const compactStatus = visibleError
      ? text('Check file', '檢查檔案')
      : document
        ? text('Loaded', '已載入')
        : text('Original', '原文');
    return (
      <section className="private-vocabulary-quick" aria-label={text('Private vocabulary upload', '私人詞彙上載')}>
        <button
          ref={compactTriggerRef}
          type="button"
          className="tonal-button private-vocabulary-quick__trigger"
          aria-haspopup="dialog"
          aria-expanded={compactOpen}
          aria-controls="private-vocabulary-quick-panel"
          aria-label={`${text('Private vocabulary', '私人詞彙')}: ${status}`}
          onClick={() => setCompactOpen(true)}
        >
          <span className="private-vocabulary-quick__badge" aria-hidden="true">JSON</span>
          <span className="private-vocabulary-quick__state" aria-live="polite">{compactStatus}</span>
        </button>
        {compactOpen && (
          <>
            <button type="button" className="private-vocabulary-quick__scrim" aria-label={text('Close private vocabulary panel', '關閉私人詞彙面板')} onClick={closeCompact} />
            <div
              ref={compactPanelRef}
              id="private-vocabulary-quick-panel"
              className="private-vocabulary-quick__panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="private-vocabulary-quick-heading"
              onKeyDown={onCompactKeyDown}
            >
              <header>
                <div>
                  <span className="eyebrow">{text('Local-only setting', '只限本機設定')}</span>
                  <h2 id="private-vocabulary-quick-heading">{text('Private vocabulary', '私人詞彙')}</h2>
                </div>
                <button type="button" className="text-button" onClick={closeCompact}>{text('Close', '關閉')}</button>
              </header>
              <ActionIllustration surface="sheet-private-vocabulary" language={activeLanguage} schoolMode={schoolMode} variant="panel" />
              <p>{text('Choose a validated version 1 JSON file up to 64 KiB. It stays only in this browser.', '揀選最多 64 KiB 嘅已驗證版本 1 JSON 檔案。內容只留喺呢個瀏覽器。')}</p>
              <label className="private-vocabulary-quick__upload">
                <span>{text('Choose private vocabulary JSON', '揀選私人詞彙 JSON')}</span>
                <input ref={inputRef} type="file" accept="application/json,.json" aria-label={text('Upload private vocabulary JSON file', '上載私人詞彙 JSON 檔案')} onChange={onFile} />
              </label>
              <div className="private-vocabulary-control__status" aria-live="polite">
                <strong>{status}</strong>
                <p>{message ?? (document ? text('A validated private browser cache is active.', '已啟用通過驗證嘅私人瀏覽器快取。') : text('No file is loaded, so shipped wording remains unchanged.', '未載入檔案，所以出廠文案保持不變。'))}</p>
              </div>
              {visibleError && <p className="field-error" role="alert">{visibleError}</p>}
              <button type="button" className="text-button" onClick={clear} disabled={!document && !error}>{text('Clear local vocabulary', '清除本機私人詞彙')}</button>
            </div>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="private-vocabulary-control" aria-labelledby="private-vocabulary-heading">
      <h2 id="private-vocabulary-heading">{text('Private vocabulary', '私人詞彙')}</h2>
      <ActionIllustration surface="feature-private-vocabulary" language={activeLanguage} schoolMode={schoolMode} variant="card" />
      <p>{text('Choose a version 1 JSON file up to 64 KiB. It is validated and cached only in this browser; it is never sent, logged, exported, or added to history.', '揀選最多 64 KiB 嘅版本 1 JSON 檔案。內容只會喺呢個瀏覽器驗證同快取，唔會傳送、記錄、匯出或者加入歷史。')}</p>
      <label>
        {text('Private vocabulary JSON file', '私人詞彙 JSON 檔案')}
        <input ref={inputRef} type="file" accept="application/json,.json" onChange={onFile} />
      </label>
      <div className="private-vocabulary-control__status" aria-live="polite">
        <strong>{document ? text('Local vocabulary loaded', '已載入本機詞彙') : text('Original wording active', '使用原本文案')}</strong>
        <p>{message ?? (document ? text('A validated private browser cache is active.', '已啟用通過驗證嘅私人瀏覽器快取。') : text('No file is loaded, so shipped wording remains unchanged.', '未載入檔案，所以出廠文案保持不變。'))}</p>
      </div>
      {visibleError && <p className="field-error" role="alert">{visibleError}</p>}
      <p className="private-vocabulary-control__preview"><span>{text('Local preview', '本機預覽')}</span><strong>{PREVIEW_SOURCE}</strong></p>
      <button type="button" className="text-button" onClick={clear} disabled={!document && !error}>{text('Clear local vocabulary', '清除本機私人詞彙')}</button>
    </section>
  );
}
