import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  createPrivateVocabularyTransform,
  loadPrivateVocabulary,
  PRIVATE_VOCABULARY_CHANGE_EVENT,
  PRIVATE_VOCABULARY_KEY,
  type PrivateVocabularyDocument,
} from './vocabulary';

interface RenderRecord {
  source: string;
  rendered: string;
}

const EXCLUDED_CONTENT = 'script, style, code, pre, kbd, [data-private-vocabulary-verbatim]';
const TRANSLATABLE_ATTRIBUTES = ['alt', 'aria-description', 'aria-label', 'placeholder', 'title'] as const;

export function usePrivateVocabularyBoundary(enabled: boolean) {
  const rootRef = useRef<HTMLDivElement>(null);
  const textRecords = useRef(new WeakMap<Text, RenderRecord>());
  const attributeRecords = useRef(new WeakMap<Element, Map<string, RenderRecord>>());
  const pendingTextMutations = useRef(new WeakMap<Text, number>());
  const pendingAttributeMutations = useRef(new WeakMap<Element, Map<string, number>>());
  const [document, setDocument] = useState<PrivateVocabularyDocument | null>(() => loadPrivateVocabulary());

  useEffect(() => {
    const synchronize = () => setDocument(loadPrivateVocabulary());
    const synchronizeStorage = (event: StorageEvent) => {
      if (event.key === PRIVATE_VOCABULARY_KEY) synchronize();
    };
    window.addEventListener(PRIVATE_VOCABULARY_CHANGE_EVENT, synchronize);
    window.addEventListener('storage', synchronizeStorage);
    return () => {
      window.removeEventListener(PRIVATE_VOCABULARY_CHANGE_EVENT, synchronize);
      window.removeEventListener('storage', synchronizeStorage);
    };
  }, []);

  const transform = useMemo(
    () => createPrivateVocabularyTransform(enabled ? document : null),
    [document, enabled],
  );

  const renderVocabulary = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const walker = window.document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode() as Text | null;
    while (textNode) {
      const parent = textNode.parentElement;
      if (parent && !parent.closest(EXCLUDED_CONTENT) && textNode.data.trim()) {
        const previous = textRecords.current.get(textNode);
        const source = previous && textNode.data === previous.rendered ? previous.source : textNode.data;
        const rendered = transform(source);
        textRecords.current.set(textNode, { source, rendered });
        if (textNode.data !== rendered) {
          pendingTextMutations.current.set(textNode, (pendingTextMutations.current.get(textNode) ?? 0) + 1);
          textNode.data = rendered;
        }
      }
      textNode = walker.nextNode() as Text | null;
    }

    for (const element of root.querySelectorAll<HTMLElement>('*')) {
      if (element.closest(EXCLUDED_CONTENT)) continue;
      let records = attributeRecords.current.get(element);
      if (!records) {
        records = new Map();
        attributeRecords.current.set(element, records);
      }
      for (const attribute of TRANSLATABLE_ATTRIBUTES) {
        const current = element.getAttribute(attribute);
        if (current === null) continue;
        const previous = records.get(attribute);
        const source = previous && current === previous.rendered ? previous.source : current;
        const rendered = transform(source);
        records.set(attribute, { source, rendered });
        if (current !== rendered) {
          let pending = pendingAttributeMutations.current.get(element);
          if (!pending) {
            pending = new Map();
            pendingAttributeMutations.current.set(element, pending);
          }
          pending.set(attribute, (pending.get(attribute) ?? 0) + 1);
          element.setAttribute(attribute, rendered);
        }
      }
    }
  }, [transform]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const observer = new MutationObserver((mutations) => {
      let needsRender = false;
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          const target = mutation.target as Text;
          const pending = pendingTextMutations.current.get(target) ?? 0;
          if (pending > 0) {
            if (pending === 1) pendingTextMutations.current.delete(target);
            else pendingTextMutations.current.set(target, pending - 1);
          } else {
            textRecords.current.delete(target);
            needsRender = true;
          }
          continue;
        }

        if (mutation.type === 'attributes' && mutation.attributeName) {
          const target = mutation.target as Element;
          const attribute = mutation.attributeName;
          const pendingByAttribute = pendingAttributeMutations.current.get(target);
          const pending = pendingByAttribute?.get(attribute) ?? 0;
          if (pending > 0 && pendingByAttribute) {
            if (pending === 1) pendingByAttribute.delete(attribute);
            else pendingByAttribute.set(attribute, pending - 1);
            if (pendingByAttribute.size === 0) pendingAttributeMutations.current.delete(target);
          } else {
            attributeRecords.current.get(target)?.delete(attribute);
            needsRender = true;
          }
          continue;
        }

        needsRender = true;
      }
      if (needsRender) renderVocabulary();
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...TRANSLATABLE_ATTRIBUTES] });
    renderVocabulary();
    return () => {
      observer.disconnect();
      pendingTextMutations.current = new WeakMap();
      pendingAttributeMutations.current = new WeakMap();
    };
  }, [renderVocabulary]);

  return { rootRef, transform };
}
