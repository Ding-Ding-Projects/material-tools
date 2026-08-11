import { beforeEach, describe, expect, it } from 'vitest';
import { initialState } from './catalog';
import { loadState, saveState, STORAGE_KEY } from './storage';

describe('browser-local persistence', () => {
  beforeEach(() => window.localStorage.clear());

  it('round-trips dock, pin, grouping, and order state', () => {
    const changed = structuredClone(initialState);
    changed.preferences.dock = 'bottom';
    changed.tabs[1].pinned = true;
    changed.tabs[1].groupId = 'delivery';
    changed.tabs[1].order = 99;
    saveState(changed);

    const loaded = loadState(initialState);
    expect(loaded.preferences.dock).toBe('bottom');
    expect(loaded.tabs[1]).toMatchObject({ pinned: true, groupId: 'delivery', order: 99 });
  });

  it('fails safely when local data is corrupt or from another schema version', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadState(initialState).preferences.dock).toBe('left');
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2 }));
    expect(loadState(initialState).version).toBe(1);
  });

  it('repairs structurally invalid version-one data instead of exposing an empty shell', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      tabs: [],
      groups: [],
      notifications: [],
      preferences: {},
      appearance: {},
    }));

    const loaded = loadState(initialState);
    expect(loaded.tabs).toHaveLength(initialState.tabs.length);
    expect(loaded.groups).toHaveLength(initialState.groups.length);
    expect(loaded.tabs[0].id).toBe('overview');
  });

  it('rejects tabs whose groups do not exist and unsafe preference values', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...initialState,
      preferences: { ...initialState.preferences, accent: 'transparent', dock: 'ceiling' },
      tabs: [{ ...initialState.tabs[0], groupId: 'missing' }],
    }));

    const loaded = loadState(initialState);
    expect(loaded.preferences.accent).toBe(initialState.preferences.accent);
    expect(loaded.preferences.dock).toBe('left');
    expect(loaded.tabs).toHaveLength(initialState.tabs.length);
  });

  it('repairs groups and tabs atomically when fallback tabs cannot use custom groups', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...initialState,
      groups: [{ id: 'custom', name: 'Custom', nameYue: '自訂', color: '#112233', collapsed: false, order: 0 }],
      tabs: [],
    }));

    const loaded = loadState(initialState);
    expect(loaded.groups.map((group) => group.id)).toEqual(initialState.groups.map((group) => group.id));
    expect(loaded.tabs.every((tab) => loaded.groups.some((group) => group.id === tab.groupId))).toBe(true);
  });
});
