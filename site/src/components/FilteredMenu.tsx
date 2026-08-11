import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { matchesSearch } from '../regex';
import type { SearchState } from '../types';
import { SearchBox } from './SearchBox';

export interface MenuAction {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void;
}

interface FilteredMenuProps {
  title: string;
  actions: MenuAction[];
  onClose: () => void;
  className?: string;
  returnFocusId?: string;
}

export function FilteredMenu({ title, actions, onClose, className, returnFocusId }: FilteredMenuProps) {
  const [search, setSearch] = useState<SearchState>({ query: '', regex: false, flags: 'i' });
  const itemsRef = useRef<HTMLDivElement>(null);
  const visible = useMemo(
    () => actions.filter((action) => matchesSearch(`${action.label} ${action.description ?? ''}`, search)),
    [actions, search],
  );

  useEffect(() => () => {
    if (returnFocusId) requestAnimationFrame(() => document.getElementById(returnFocusId)?.focus());
  }, [returnFocusId]);

  function handleKeys(event: KeyboardEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest('.regex-builder')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const items = [...(itemsRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])];
    if (items.length === 0) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    items[(current + delta + items.length) % items.length].focus();
  }

  return (
    <section className={`filtered-menu ${className ?? ''}`} role="dialog" aria-label={title} onKeyDown={handleKeys}>
      <header className="filtered-menu__header">
        <strong>{title}</strong>
        <button type="button" className="text-button" onClick={onClose}>Close</button>
      </header>
      <SearchBox label={`${title} actions`} state={search} onChange={setSearch} resultCount={visible.length} compact autoFocus />
      <div ref={itemsRef} className="filtered-menu__items" role="menu">
        {visible.length > 0 ? visible.map((action) => (
          <button
            key={action.id}
            type="button"
            role="menuitem"
            disabled={action.disabled}
            title={action.disabled ? action.description : undefined}
            onClick={() => {
              action.onSelect();
              onClose();
            }}
          >
            <span>
              <strong>{action.label}</strong>
              {action.description && <small>{action.description}</small>}
            </span>
            {action.shortcut && <kbd aria-label={`Shortcut ${action.shortcut}`}>{action.shortcut}</kbd>}
          </button>
        )) : <p className="empty-state">No matching actions.</p>}
      </div>
    </section>
  );
}
