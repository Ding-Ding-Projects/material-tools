import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import {
  applyPrivateVocabulary,
  cachePrivateVocabulary,
  clearPrivateVocabulary,
  loadPrivateVocabulary,
  MAX_PRIVATE_VOCABULARY_BYTES,
  parsePrivateVocabulary,
  PRIVATE_VOCABULARY_CHANGE_EVENT,
  type PrivateVocabularyDocument,
} from '../vocabulary';
import type { LanguageMode } from '../types';

const PREVIEW_SOURCE = 'Windows setup, mapped.';

interface PrivateVocabularyControlProps {
  compact?: boolean;
  language?: LanguageMode;
  schoolMode?: boolean;
}

export function PrivateVocabularyControl({ compact = false, language = 'en', schoolMode = false }: PrivateVocabularyControlProps) {
  const [document, setDocument] = useState<PrivateVocabularyDocument | null>(() => loadPrivateVocabulary());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeLanguage = schoolMode ? 'en' : language;
  const text = (english: string, cantonese: string) => activeLanguage === 'yue' ? cantonese : activeLanguage === 'both' ? `${english} · ${cantonese}` : english;
  const visibleError = error ? text(error, '檔案未能通過版本、格式或者大小驗證。') : null;

  useEffect(() => {
    const synchronize = () => setDocument(loadPrivateVocabulary());
    window.addEventListener(PRIVATE_VOCABULARY_CHANGE_EVENT, synchronize);
    return () => window.removeEventListener(PRIVATE_VOCABULARY_CHANGE_EVENT, synchronize);
  }, []);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setMessage(null);
    setError(null);
    if (!file) return;
    if (file.size > MAX_PRIVATE_VOCABULARY_BYTES) {
      setError('The file is larger than the 64 KiB local limit.');
      event.target.value = '';
      return;
    }
    const parsed = parsePrivateVocabulary(await file.text());
    if (!parsed.document) {
      setError(parsed.error ?? 'The private vocabulary file could not be validated.');
      event.target.value = '';
      return;
    }
    cachePrivateVocabulary(parsed.document);
    setDocument(parsed.document);
    setMessage(text(
      `Loaded ${Object.keys(parsed.document.replacements).length} replacement entries into this browser only.`,
      `已將 ${Object.keys(parsed.document.replacements).length} 個替換項目只載入到呢個瀏覽器。`,
    ));
    event.target.value = '';
  }

  function clear() {
    clearPrivateVocabulary();
    setDocument(null);
    setError(null);
    setMessage(text('The local private vocabulary cache was cleared. Original wording is active.', '本機私人詞彙快取已清除，而家使用原本文案。'));
    if (inputRef.current) inputRef.current.value = '';
  }

  if (compact) {
    return (
      <section className="private-vocabulary-quick" aria-label={text('Private vocabulary upload', '私人詞彙上載')}>
        <label className="private-vocabulary-quick__upload">
          <span>{text('Private vocabulary JSON', '私人詞彙 JSON')}</span>
          <input ref={inputRef} type="file" accept="application/json,.json" aria-label={text('Upload private vocabulary JSON file', '上載私人詞彙 JSON 檔案')} onChange={onFile} />
        </label>
        <span className="private-vocabulary-quick__state" aria-live="polite">{visibleError ?? (document ? text('Loaded locally', '只喺本機載入') : text('Original wording', '使用原本文案'))}</span>
        <button type="button" className="text-button" onClick={clear} disabled={!document && !error}>{text('Clear', '清除')}</button>
      </section>
    );
  }

  return (
    <section className="private-vocabulary-control" aria-labelledby="private-vocabulary-heading">
      <h2 id="private-vocabulary-heading">{text('Private vocabulary', '私人詞彙')}</h2>
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
      <p className="private-vocabulary-control__preview"><span>{text('Local preview', '本機預覽')}</span><strong>{applyPrivateVocabulary(PREVIEW_SOURCE, document)}</strong></p>
      <button type="button" className="text-button" onClick={clear} disabled={!document && !error}>{text('Clear local vocabulary', '清除本機私人詞彙')}</button>
    </section>
  );
}
