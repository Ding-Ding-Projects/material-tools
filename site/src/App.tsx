import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { articles, initialState } from './catalog';
import { bestContrastingText } from './color';
import { coverageInventory } from './coverage';
import { matchesSearch } from './regex';
import { loadState, saveState, STORAGE_KEY } from './storage';
import type {
  DockEdge,
  ElementAppearance,
  FeatureArticle,
  LanguageMode,
  NotificationRecord,
  PersistedState,
  Preferences,
  SearchState,
  TabRecord,
  ThemeMode,
} from './types';
import { FilteredMenu, type MenuAction } from './components/FilteredMenu';
import { ColorControl } from './components/ColorControl';
import { PrivateVocabularyControl } from './components/PrivateVocabularyControl';
import { SearchBox } from './components/SearchBox';

const emptySearch = (): SearchState => ({ query: '', regex: false, flags: 'i' });

function localized(en: string, yue: string, preferences: Preferences) {
  const mode = preferences.schoolMode ? 'en' : preferences.language;
  if (mode === 'yue') return yue;
  if (mode === 'both') return `${en} · ${yue}`;
  return en;
}

function heroCopy(preferences: Preferences) {
  const englishLevels = [
    'Explore the full Windows setup workflow from application installation through custom image creation.',
    'Map application installs, measured tweaks, repairs, updates, and custom image creation in one workflow.',
    'Keep installs, tweaks, fixes, updates, and image creation together, where the mystery switches can be questioned politely.',
    'One control room for installs, careful tweaks, repairs, updates, and a custom Windows image. Fewer mystery checkboxes; more receipts.',
    'Put installs, tweaks, repairs, updates, and image creation on one map before a mystery checkbox starts wearing a fake moustache.',
  ];
  const cantoneseLevels = [
    '由應用程式安裝到自訂映像建立，完整瀏覽 Windows 設定流程。',
    '將安裝、調校、修復、更新同自訂映像放入同一套清晰流程。',
    '安裝、調校、修復、更新同映像建立排好隊，啲神秘掣都要有禮貌交代。',
    '安裝、調校、修復、更新同自訂映像一次過睇清楚，唔使再同神秘剔選格鬥法。',
    '將成套設定流程擺上地圖，等啲神秘剔選格未戴假鬚扮專家之前先交代清楚。',
  ];
  const en = englishLevels[Math.min(5, Math.max(1, preferences.funnyEnglish)) - 1];
  const yue = cantoneseLevels[Math.min(5, Math.max(1, preferences.funnyCantonese)) - 1];
  return localized(en, yue, preferences);
}

function appearanceStyle(appearance?: ElementAppearance): CSSProperties {
  if (!appearance) return {};
  return {
    '--item-accent': appearance.accent,
    '--item-radius': `${appearance.radius}px`,
    fontWeight: appearance.emphasis === 'strong' ? 700 : 500,
  } as CSSProperties;
}

export default function App() {
  const [state, setState] = useState<PersistedState>(() => loadState(initialState));
  const [activeTab, setActiveTab] = useState('overview');
  const [contextTab, setContextTab] = useState<string | null>(null);
  const [groupPickerTab, setGroupPickerTab] = useState<string | null>(null);
  const [appearanceTarget, setAppearanceTarget] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState<SearchState>(emptySearch);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [currentSearch, setCurrentSearch] = useState<SearchState>(emptySearch);
  const [groupSearch, setGroupSearch] = useState<SearchState>(emptySearch);
  const [groupNameSearch, setGroupNameSearch] = useState<SearchState>(emptySearch);
  const [masterSearch, setMasterSearch] = useState<SearchState>(emptySearch);
  const [notificationSearch, setNotificationSearch] = useState<SearchState>(emptySearch);
  const [transientRevealGroup, setTransientRevealGroup] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const paletteRef = useRef<HTMLElement>(null);
  const paletteReturnRef = useRef<HTMLElement | null>(null);

  useEffect(() => saveState(state), [state]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = state.preferences.theme;
    root.dataset.density = state.preferences.density;
    root.style.setProperty('--md-sys-color-primary', state.preferences.accent);
    root.style.setProperty('--md-sys-color-on-primary', bestContrastingText(state.preferences.accent));
    root.style.setProperty('--user-font-scale', String(state.preferences.fontScale));
    document.documentElement.lang = 'en';
  }, [state.preferences]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey && event.shiftKey && event.key.toLocaleLowerCase() === 'f') {
        event.preventDefault();
        openPalette();
      }
      if (event.key === 'Escape') {
        if (paletteOpen) closePalette();
        setContextTab(null);
        setGroupPickerTab(null);
        setAppearanceTarget(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paletteOpen]);

  useEffect(() => {
    const timers = state.notifications
      .filter((notification) => !notification.dismissed && notification.kind !== 'warning')
      .map((notification) => window.setTimeout(() => {
        setState((current) => ({
          ...current,
          notifications: current.notifications.map((item) => item.id === notification.id ? { ...item, dismissed: true } : item),
        }));
      }, 6500));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [state.notifications]);

  const preferences = state.preferences;
  const groups = useMemo(() => [...state.groups].sort((a, b) => a.order - b.order), [state.groups]);
  const orderedTabs = useMemo(
    () => [...state.tabs].sort((a, b) => a.order - b.order),
    [state.tabs],
  );
  const activeRecord = state.tabs.find((tab) => tab.id === activeTab) ?? state.tabs[0] ?? initialState.tabs[0];
  const visibleStripTabs = useMemo(() => [
    ...orderedTabs.filter((tab) => tab.pinned),
    ...groups.flatMap((group) => group.collapsed && transientRevealGroup !== group.id
      ? []
      : orderedTabs.filter((tab) => !tab.pinned && tab.groupId === group.id)),
  ], [groups, orderedTabs, transientRevealGroup]);

  function openPalette() {
    paletteReturnRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPaletteOpen(true);
  }

  function closePalette() {
    setPaletteOpen(false);
    requestAnimationFrame(() => paletteReturnRef.current?.focus());
  }

  function containPaletteFocus(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab') return;
    const focusable = [...(paletteRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function updatePreferences(patch: Partial<Preferences>) {
    setState((current) => ({ ...current, preferences: { ...current.preferences, ...patch } }));
  }

  function announce(kind: NotificationRecord['kind'], title: string, body: string) {
    const notification: NotificationRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title,
      body,
      createdAt: new Date().toISOString(),
      kind,
      dismissed: false,
    };
    setState((current) => ({ ...current, notifications: [notification, ...current.notifications] }));
  }

  function activateTab(tabId: string) {
    setActiveTab(tabId);
    const tab = state.tabs.find((item) => item.id === tabId);
    const group = tab ? state.groups.find((item) => item.id === tab.groupId) : undefined;
    setTransientRevealGroup(group?.collapsed ? group.id : null);
    setPaletteOpen(false);
    requestAnimationFrame(() => mainRef.current?.focus());
  }

  function togglePin(tabId: string) {
    const tab = state.tabs.find((item) => item.id === tabId);
    setState((current) => ({
      ...current,
      tabs: current.tabs.map((item) => item.id === tabId ? { ...item, pinned: !item.pinned } : item),
    }));
    if (tab) announce('success', tab.pinned ? 'Tab unpinned' : 'Tab pinned', `${tab.label} was updated.`);
  }

  function moveTab(tabId: string, direction: -1 | 1) {
    setState((current) => {
      const selected = current.tabs.find((tab) => tab.id === tabId);
      if (!selected) return current;
      const sorted = current.tabs
        .filter((tab) => tab.pinned === selected.pinned && (selected.pinned || tab.groupId === selected.groupId))
        .sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((tab) => tab.id === tabId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= sorted.length) return current;
      const currentOrder = sorted[index].order;
      const targetOrder = sorted[target].order;
      return {
        ...current,
        tabs: current.tabs.map((tab) => {
          if (tab.id === sorted[index].id) return { ...tab, order: targetOrder };
          if (tab.id === sorted[target].id) return { ...tab, order: currentOrder };
          return tab;
        }),
      };
    });
  }

  function moveToGroup(tabId: string, groupId: string) {
    const group = state.groups.find((item) => item.id === groupId);
    const tab = state.tabs.find((item) => item.id === tabId);
    if (group?.collapsed && tab?.id === activeTab && !tab.pinned) {
      setActiveTab('overview');
      setTransientRevealGroup(null);
    }
    setState((current) => ({
      ...current,
      tabs: current.tabs.map((tab) => tab.id === tabId ? { ...tab, groupId } : tab),
    }));
    if (group) announce('success', 'Tab moved', `The tab now belongs to ${group.name}.`);
  }

  function toggleGroup(groupId: string) {
    const group = state.groups.find((item) => item.id === groupId);
    const active = state.tabs.find((item) => item.id === activeTab);
    const isExpanded = group ? !group.collapsed || transientRevealGroup === group.id : false;
    if (isExpanded && active?.groupId === groupId && !active.pinned) setActiveTab('overview');
    if (group?.collapsed && transientRevealGroup === groupId) {
      setTransientRevealGroup(null);
      return;
    }
    setTransientRevealGroup(null);
    setState((current) => ({
      ...current,
      groups: current.groups.map((group) => group.id === groupId ? { ...group, collapsed: !group.collapsed } : group),
    }));
  }

  function saveAppearance(target: string, patch: Partial<ElementAppearance>) {
    const existing = state.appearance[target] ?? { accent: preferences.accent, radius: 18, emphasis: 'regular' as const };
    setState((current) => ({
      ...current,
      appearance: { ...current.appearance, [target]: { ...existing, ...patch } },
    }));
  }

  const contextActions = (tab: TabRecord): MenuAction[] => [
    {
      id: 'pin',
      label: tab.pinned ? 'Unpin tab' : 'Pin tab',
      description: tab.pinned ? 'Return it to its group region.' : 'Keep it visible in the protected region.',
      onSelect: () => togglePin(tab.id),
    },
    { id: 'earlier', label: 'Move earlier', description: 'Move one place in the saved tab order.', onSelect: () => moveTab(tab.id, -1) },
    { id: 'later', label: 'Move later', description: 'Move one place in the saved tab order.', onSelect: () => moveTab(tab.id, 1) },
    { id: 'group', label: 'Move… into group…', description: 'Open the searchable group picker.', onSelect: () => setGroupPickerTab(tab.id) },
    { id: 'appearance', label: 'Edit tab appearance…', description: 'Adjust this tab without changing the global theme.', onSelect: () => setAppearanceTarget(`tab:${tab.id}`) },
  ];

  function onTabKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, tab: TabRecord) {
    const vertical = preferences.dock === 'left' || preferences.dock === 'right';
    const previousKey = vertical ? 'ArrowUp' : 'ArrowLeft';
    const nextKey = vertical ? 'ArrowDown' : 'ArrowRight';
    if (event.key !== previousKey && event.key !== nextKey) return;
    event.preventDefault();
    const index = visibleStripTabs.findIndex((item) => item.id === tab.id);
    const delta = event.key === previousKey ? -1 : 1;
    const target = visibleStripTabs[(index + delta + visibleStripTabs.length) % visibleStripTabs.length];
    activateTab(target.id);
    document.getElementById(`tab-${target.id}`)?.focus();
  }

  const paletteCommands = useMemo(() => {
    const navigation = state.tabs.map((tab) => ({
      id: `go-${tab.id}`,
      label: `Open ${tab.label}`,
      context: `${groups.find((group) => group.id === tab.groupId)?.name ?? ''} tab`,
      action: () => activateTab(tab.id),
    }));
    return [
      ...navigation,
      { id: 'theme-light', label: 'Use light theme', context: 'Appearance setting', action: () => updatePreferences({ theme: 'light' }) },
      { id: 'theme-dark', label: 'Use dark theme', context: 'Appearance setting', action: () => updatePreferences({ theme: 'dark' }) },
      { id: 'dock-left', label: 'Dock tabs left', context: 'Navigation setting', action: () => updatePreferences({ dock: 'left' }) },
      { id: 'show-discovery', label: 'Open tab discovery', context: 'Navigation tool', action: () => { setDiscoveryOpen(true); setPaletteOpen(false); } },
      { id: 'toggle-emoji', label: preferences.showEmoji ? 'Hide message emoji decorations' : 'Show message emoji decorations', context: 'Message setting', action: () => updatePreferences({ showEmoji: !preferences.showEmoji }) },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, preferences.showEmoji, state.tabs]);

  const filteredPalette = useMemo(
    () => paletteCommands.filter((command) => matchesSearch(`${command.label} ${command.context}`, paletteSearch)),
    [paletteCommands, paletteSearch],
  );

  const liveToasts = state.notifications.filter((notification) => !notification.dismissed).slice(0, 3);
  const selectedAppearance = appearanceTarget ? state.appearance[appearanceTarget] : undefined;

  return (
    <div className={`app-shell dock-${preferences.dock}`}>
      <header className="top-app-bar">
        <button className="brand" type="button" onClick={() => activateTab('overview')} aria-label="Open Material Tools overview">
          <span className="brand__mark" aria-hidden="true">M</span>
          <span><strong>Material Tools</strong><small>{localized('Windows setup, mapped', 'Windows 設定，一目了然', preferences)}</small></span>
        </button>
        <div className="top-app-bar__actions">
          <PrivateVocabularyControl compact language={preferences.language} schoolMode={preferences.schoolMode} />
          <button type="button" className="tonal-button" onClick={() => setDiscoveryOpen((open) => !open)} aria-expanded={discoveryOpen}>
            Tab discovery
          </button>
          <button type="button" className="filled-button" onClick={openPalette}>
            Command palette <kbd>Ctrl+Shift+F</kbd>
          </button>
        </div>
      </header>

      <nav className="tab-rail" aria-label="Feature tabs">
        <div
          className="tab-rail__list"
          role="tablist"
          aria-orientation={preferences.dock === 'left' || preferences.dock === 'right' ? 'vertical' : 'horizontal'}
        >
          {orderedTabs.filter((tab) => tab.pinned).map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              active={tab.id === activeTab}
              preferences={preferences}
              appearance={state.appearance[`tab:${tab.id}`]}
              onActivate={() => activateTab(tab.id)}
              onKeyDown={(event) => onTabKeyDown(event, tab)}
              onMenu={() => setContextTab(tab.id)}
            />
          ))}
          {groups.map((group) => {
            const groupTabs = orderedTabs.filter((tab) => !tab.pinned && tab.groupId === group.id);
            if (groupTabs.length === 0) return null;
            const groupExpanded = !group.collapsed || transientRevealGroup === group.id;
            return (
              <section className="tab-group" key={group.id} aria-label={localized(group.name, group.nameYue, preferences)}>
                <button
                  type="button"
                  className="tab-group__header"
                  aria-expanded={groupExpanded}
                  aria-label={`Toggle ${localized(group.name, group.nameYue, preferences)} group`}
                  onClick={() => toggleGroup(group.id)}
                  style={{ '--group-color': group.color } as CSSProperties}
                >
                  <span aria-hidden="true">{groupExpanded ? '−' : '+'}</span>
                  {localized(group.name, group.nameYue, preferences)}
                  <small>{groupTabs.length}</small>
                </button>
                {groupExpanded && groupTabs.map((tab) => (
                  <TabButton
                    key={tab.id}
                    tab={tab}
                    active={tab.id === activeTab}
                    preferences={preferences}
                    appearance={state.appearance[`tab:${tab.id}`]}
                    onActivate={() => activateTab(tab.id)}
                    onKeyDown={(event) => onTabKeyDown(event, tab)}
                    onMenu={() => setContextTab(tab.id)}
                  />
                ))}
              </section>
            );
          })}
        </div>
      </nav>

      <main id="main-content" ref={mainRef} tabIndex={-1}>
        {discoveryOpen && (
          <DiscoveryPanel
            tabs={state.tabs}
            visibleTabs={visibleStripTabs}
            activeGroupId={activeRecord.groupId}
            groups={state.groups}
            preferences={preferences}
            currentSearch={currentSearch}
            groupSearch={groupSearch}
            groupNameSearch={groupNameSearch}
            masterSearch={masterSearch}
            setCurrentSearch={setCurrentSearch}
            setGroupSearch={setGroupSearch}
            setGroupNameSearch={setGroupNameSearch}
            setMasterSearch={setMasterSearch}
            activateTab={activateTab}
            toggleGroup={toggleGroup}
            onClose={() => setDiscoveryOpen(false)}
          />
        )}
        {activeTab === 'overview' && (
          <OverviewPage
            preferences={preferences}
            state={state}
            activateTab={activateTab}
            editAppearance={(target) => setAppearanceTarget(target)}
          />
        )}
        {articles.some((article) => article.id === activeTab) && (
          <ArticlePage
            article={articles.find((article) => article.id === activeTab)!}
            preferences={preferences}
            appearance={state.appearance[`card:${activeTab}`]}
            editAppearance={() => setAppearanceTarget(`card:${activeTab}`)}
            notify={announce}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsPage
            state={state}
            updatePreferences={updatePreferences}
            notify={announce}
          />
        )}
        {activeTab === 'notifications' && (
          <NotificationsPage
            state={state}
            search={notificationSearch}
            setSearch={setNotificationSearch}
            dismiss={(id) => setState((current) => ({ ...current, notifications: current.notifications.map((item) => item.id === id ? { ...item, dismissed: true } : item) }))}
            notify={announce}
          />
        )}
      </main>

      {contextTab && (() => {
        const tab = state.tabs.find((item) => item.id === contextTab);
        return tab ? <FilteredMenu title={`${tab.label} tab`} actions={contextActions(tab)} onClose={() => setContextTab(null)} returnFocusId={`tab-${tab.id}`} className="floating-panel tab-context-panel" /> : null;
      })()}

      {groupPickerTab && (
        <FilteredMenu
          title="Move into group"
          className="floating-panel group-picker-panel"
          actions={groups.map((group) => ({
            id: group.id,
            label: localized(group.name, group.nameYue, preferences),
            description: `${state.tabs.filter((tab) => tab.groupId === group.id).length} members`,
            onSelect: () => moveToGroup(groupPickerTab, group.id),
          }))}
          onClose={() => setGroupPickerTab(null)}
          returnFocusId={`tab-${groupPickerTab}`}
        />
      )}

      {appearanceTarget && (
        <AppearanceEditor
          target={appearanceTarget}
          value={selectedAppearance ?? { accent: preferences.accent, radius: 18, emphasis: 'regular' }}
          onChange={(patch) => saveAppearance(appearanceTarget, patch)}
          onReset={() => setState((current) => {
            const appearance = { ...current.appearance };
            delete appearance[appearanceTarget];
            return { ...current, appearance };
          })}
          onClose={() => setAppearanceTarget(null)}
        />
      )}

      {paletteOpen && (
        <div className="scrim" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closePalette()}>
          <section ref={paletteRef} className={`command-palette command-palette--${preferences.paletteSize}`} role="dialog" aria-modal="true" aria-label="Command palette" onKeyDown={containPaletteFocus}>
            <header>
              <div><span className="eyebrow">Global command palette</span><h2>Go directly to a feature or control</h2></div>
              <div className="button-row">
                <button type="button" className="text-button" onClick={() => updatePreferences({ paletteSize: preferences.paletteSize === 'card' ? 'full' : 'card' })}>
                  {preferences.paletteSize === 'card' ? 'Full window' : 'Card size'}
                </button>
                <button type="button" className="text-button" onClick={closePalette}>Close</button>
              </div>
            </header>
            <SearchBox label="Commands and destinations" state={paletteSearch} onChange={setPaletteSearch} resultCount={filteredPalette.length} autoFocus />
            <div className="palette-results" aria-label="Command results">
              {filteredPalette.map((command) => (
                <button key={command.id} type="button" onClick={command.action}>
                  <span><strong>{command.label}</strong><small>{command.context}</small></span>
                  <span aria-hidden="true">→</span>
                </button>
              ))}
              {filteredPalette.length === 0 && <p className="empty-state">No commands match this search.</p>}
            </div>
          </section>
        </div>
      )}

      <div className="toast-region" aria-live="polite" aria-label="Current notifications">
        {liveToasts.map((notification) => (
          <article className={`toast toast--${notification.kind}`} key={notification.id}>
            {preferences.showEmoji && <span className="toast__decoration" aria-hidden="true">{notification.kind === 'success' ? '✅' : notification.kind === 'warning' ? '⚠️' : 'ℹ️'}</span>}
            <div><strong>{notification.title}</strong><p>{notification.body}</p></div>
            <button
              type="button"
              className="icon-button"
              aria-label={`Dismiss ${notification.title}`}
              onClick={() => setState((current) => ({ ...current, notifications: current.notifications.map((item) => item.id === notification.id ? { ...item, dismissed: true } : item) }))}
            >
              ×
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

interface TabButtonProps {
  tab: TabRecord;
  active: boolean;
  preferences: Preferences;
  appearance?: ElementAppearance;
  onActivate: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  onMenu: () => void;
}

function TabButton({ tab, active, preferences, appearance, onActivate, onKeyDown, onMenu }: TabButtonProps) {
  function openContext(event: ReactMouseEvent) {
    event.preventDefault();
    onMenu();
  }
  return (
    <div className={`tab-wrap ${active ? 'is-active' : ''}`} style={appearanceStyle(appearance)} onContextMenu={openContext}>
      <button
        id={`tab-${tab.id}`}
        type="button"
        className="tab-button"
        role="tab"
        aria-selected={active}
        aria-controls={`panel-${tab.id}`}
        aria-label={`${localized(tab.label, tab.labelYue, preferences)}${tab.pinned ? ' Pinned' : ''}`}
        tabIndex={active ? 0 : -1}
        onClick={onActivate}
        onKeyDown={onKeyDown}
      >
        <span className="tab-button__icon" aria-hidden="true">{tab.icon}</span>
        <span>{localized(tab.label, tab.labelYue, preferences)}</span>
        {tab.pinned && <span className="pin-indicator" aria-label="Pinned">P</span>}
      </button>
      <button type="button" className="tab-menu-button" aria-label={`More actions for ${tab.label}`} onClick={onMenu}>⋯</button>
    </div>
  );
}

interface DiscoveryProps {
  tabs: TabRecord[];
  visibleTabs: TabRecord[];
  activeGroupId: string;
  groups: PersistedState['groups'];
  preferences: Preferences;
  currentSearch: SearchState;
  groupSearch: SearchState;
  groupNameSearch: SearchState;
  masterSearch: SearchState;
  setCurrentSearch: (value: SearchState) => void;
  setGroupSearch: (value: SearchState) => void;
  setGroupNameSearch: (value: SearchState) => void;
  setMasterSearch: (value: SearchState) => void;
  activateTab: (tabId: string) => void;
  toggleGroup: (groupId: string) => void;
  onClose: () => void;
}

function DiscoveryPanel(props: DiscoveryProps) {
  const current = props.visibleTabs.filter((tab) => matchesSearch(tab.label, props.currentSearch));
  const grouped = props.tabs.filter((tab) => tab.groupId === props.activeGroupId && matchesSearch(tab.label, props.groupSearch));
  const groupResults = props.groups.filter((group) => matchesSearch(`${group.name} ${group.nameYue}`, props.groupNameSearch));
  const master = props.tabs.filter((tab) => {
    const group = props.groups.find((item) => item.id === tab.groupId);
    return matchesSearch(`${tab.label} ${tab.labelYue} ${group?.name ?? ''}`, props.masterSearch);
  });

  const tabResults = (items: TabRecord[]) => (
    <div className="discovery-results">
      {items.map((tab) => (
        <button key={tab.id} type="button" onClick={() => props.activateTab(tab.id)}>
          <span>{localized(tab.label, tab.labelYue, props.preferences)}</span>
          <small>{props.groups.find((group) => group.id === tab.groupId)?.name}{tab.pinned ? ' · Pinned' : ''}</small>
        </button>
      ))}
      {items.length === 0 && <p className="empty-state">No matching tabs.</p>}
    </div>
  );

  return (
    <section className="discovery-panel" aria-label="Tab discovery">
      <header><div><span className="eyebrow">Four independent searches</span><h2>Find every open destination</h2></div><button type="button" className="text-button" onClick={props.onClose}>Close</button></header>
      <div className="discovery-grid">
        <article><SearchBox label="Current tab strip" state={props.currentSearch} onChange={props.setCurrentSearch} resultCount={current.length} />{tabResults(current)}</article>
        <article><SearchBox label="Current tab group" state={props.groupSearch} onChange={props.setGroupSearch} resultCount={grouped.length} />{tabResults(grouped)}</article>
        <article>
          <SearchBox label="Tab groups by name" state={props.groupNameSearch} onChange={props.setGroupNameSearch} resultCount={groupResults.length} />
          <div className="discovery-results">
            {groupResults.map((group) => <button type="button" key={group.id} onClick={() => group.collapsed && props.toggleGroup(group.id)}><span>{localized(group.name, group.nameYue, props.preferences)}</span><small>{group.collapsed ? 'Collapsed · reveal' : 'Expanded'}</small></button>)}
          </div>
        </article>
        <article><SearchBox label="Master tab search" state={props.masterSearch} onChange={props.setMasterSearch} resultCount={master.length} />{tabResults(master)}</article>
      </div>
    </section>
  );
}

function OverviewPage({ preferences, state, activateTab, editAppearance }: { preferences: Preferences; state: PersistedState; activateTab: (id: string) => void; editAppearance: (id: string) => void }) {
  return (
    <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" className="page">
      <section className="hero-card">
        <div>
          <span className="eyebrow">Interactive documentation · local-first</span>
          <h1>{localized('Build a Windows setup you can explain', '砌一套講得明嘅 Windows 設定', preferences)}</h1>
          <p>{heroCopy(preferences)}</p>
          <div className="button-row">
            <button className="filled-button" type="button" onClick={() => activateTab('applications')}>Explore the workflow</button>
            <button className="tonal-button" type="button" onClick={() => activateTab('settings')}>Personalize this site</button>
          </div>
        </div>
        <div className="hero-diagram" aria-label="Workflow from applications through delivery">
          <span>Apps</span><i aria-hidden="true">→</i><span>Tweaks</span><i aria-hidden="true">→</i><span>Fixes</span><i aria-hidden="true">→</i><span>Delivery</span>
        </div>
      </section>
      <section className="metrics" aria-label="Coverage summary">
        <article><strong>{articles.length}</strong><span>upstream feature categories</span></article>
        <article><strong>{state.tabs.filter((tab) => tab.pinned).length}</strong><span>pinned destinations</span></article>
        <article><strong>{coverageInventory.filter((item) => item.status === 'implemented').length}</strong><span>implemented contract slices</span></article>
      </section>
      <section className="section-heading"><div><span className="eyebrow">Feature catalog</span><h2>One article for every upstream category</h2></div><p>Each card is backed by the public WinUtil documentation snapshot cited in the article.</p></section>
      <div className="feature-grid">
        {articles.map((article) => (
          <article key={article.id} className="feature-card editable-surface" style={appearanceStyle(state.appearance[`card:${article.id}`])}>
            <span className="eyebrow">{article.eyebrow}</span>
            <h3>{localized(article.title, article.titleYue, preferences)}</h3>
            <p>{localized(article.summary, article.summaryYue, preferences)}</p>
            <div className="feature-card__actions">
              <button type="button" className="tonal-button" onClick={() => activateTab(article.id)}>Read article</button>
              <button type="button" className="text-button" onClick={() => editAppearance(`card:${article.id}`)}>Edit appearance…</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ArticlePage({ article, preferences, appearance, editAppearance, notify }: { article: FeatureArticle; preferences: Preferences; appearance?: ElementAppearance; editAppearance: () => void; notify: (kind: NotificationRecord['kind'], title: string, body: string) => void }) {
  return (
    <article id={`panel-${article.id}`} role="tabpanel" aria-labelledby={`tab-${article.id}`} className="page article-page">
      <header className="article-hero editable-surface" style={appearanceStyle(appearance)}>
        <div><span className="eyebrow">{article.eyebrow}</span><h1>{localized(article.title, article.titleYue, preferences)}</h1><p>{localized(article.summary, article.summaryYue, preferences)}</p></div>
        <button type="button" className="tonal-button" onClick={editAppearance}>Edit appearance…</button>
      </header>
      <div className="article-layout">
        <section className="article-body">
          <h2>Documented capabilities</h2>
          <ul className="capability-list">{article.capabilities.map((capability) => <li key={capability}>{capability}</li>)}</ul>
          <h2>Operational notes</h2>
          <div className="note-stack">{article.notes.map((note) => <aside key={note} className="note-card"><strong>Know before you act</strong><p>{note}</p></aside>)}</div>
        </section>
        <aside className="source-card">
          <span className="eyebrow">Authoritative source</span>
          <h2>Public documentation snapshot</h2>
          <code>{article.sourcePath}</code>
          <a className="filled-button link-button" href={article.sourceUrl} target="_blank" rel="noreferrer">Open cited source</a>
          <button type="button" className="text-button" onClick={() => notify('info', 'Source recorded', 'The article keeps its commit-pinned source URL beside the capability list.')}>Explain this citation</button>
        </aside>
      </div>
    </article>
  );
}

function Segmented<T extends string>({ label, value, values, onChange }: { label: string; value: T; values: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <fieldset className="segmented-field">
      <legend>{label}</legend>
      <div className="segmented-control">
        {values.map((option) => <button key={option.value} type="button" className={value === option.value ? 'is-selected' : ''} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}
      </div>
    </fieldset>
  );
}

function SettingsPage({ state, updatePreferences, notify }: { state: PersistedState; updatePreferences: (patch: Partial<Preferences>) => void; notify: (kind: NotificationRecord['kind'], title: string, body: string) => void }) {
  const p = state.preferences;
  const [search, setSearch] = useState<SearchState>(emptySearch);
  const visible = {
    language: matchesSearch(`Language voice English Cantonese bilingual funny emoji ${p.language} ${p.funnyEnglish} ${p.funnyCantonese} ${p.showEmoji}`, search),
    school: matchesSearch(`School mode shell display name forced English ${p.schoolModeName} ${p.schoolMode}`, search),
    appearance: matchesSearch(`Appearance theme accent color density text scale ${p.theme} ${p.accent} ${p.density} ${p.fontScale}`, search),
    navigation: matchesSearch(`Tab navigation dock edge pinning grouping collapsed order ${p.dock}`, search),
    vocabulary: matchesSearch('Private vocabulary local JSON upload cache clear original wording', search),
  };
  const visibleCount = Object.values(visible).filter(Boolean).length;
  return (
    <div id="panel-settings" role="tabpanel" aria-labelledby="tab-settings" className="page settings-page">
      <header className="page-heading"><span className="eyebrow">Local visitor settings</span><h1>Make the documentation yours</h1><p>Everything on this page stays in this browser. No account, analytics, or network sync is used.</p></header>
      <div className="settings-search"><SearchBox label="Settings on this page" state={search} onChange={setSearch} resultCount={visibleCount} /></div>
      <div className="settings-grid">
        {visible.language && <section className="settings-card" id="setting-language">
          <h2>Language and voice</h2>
          {p.schoolMode ? (
            <div className="mode-lock-note"><strong>{p.schoolModeName} is active</strong><p>English is forced and playful language controls are omitted until the mode is turned off.</p></div>
          ) : (
            <>
              <Segmented<LanguageMode> label="Language mode" value={p.language} onChange={(language) => updatePreferences({ language })} values={[{ value: 'en', label: 'English' }, { value: 'yue', label: '廣東話' }, { value: 'both', label: 'Bilingual' }]} />
              <label className="range-field">English funny level <output>{p.funnyEnglish}</output><input aria-label="English funny level" type="range" min="1" max="5" value={p.funnyEnglish} onChange={(event) => updatePreferences({ funnyEnglish: Number(event.target.value) })} /></label>
              <label className="range-field">Cantonese funny level <output>{p.funnyCantonese}</output><input aria-label="Cantonese funny level" type="range" min="1" max="5" value={p.funnyCantonese} onChange={(event) => updatePreferences({ funnyCantonese: Number(event.target.value) })} /></label>
            </>
          )}
          <label className="switch-row"><input type="checkbox" checked={p.showEmoji} onChange={(event) => updatePreferences({ showEmoji: event.target.checked })} /><span>Show emoji decorations in dialogs and messages</span></label>
        </section>}

        {visible.school && <section className="settings-card" id="setting-school-mode">
          <h2>School mode shell</h2>
          <p>This local website foundation demonstrates forced-English presentation and control omission. A shared cross-app credential is not yet connected.</p>
          <label>Mode display name<input value={p.schoolModeName} onChange={(event) => updatePreferences({ schoolModeName: event.target.value.slice(0, 48) || 'School mode' })} /></label>
          <label className="switch-row"><input type="checkbox" checked={p.schoolMode} onChange={(event) => { updatePreferences({ schoolMode: event.target.checked }); notify('info', event.target.checked ? 'Mode enabled' : 'Mode disabled', event.target.checked ? 'English presentation is now forced.' : 'Your saved language and voice controls are available again.'); }} /><span>Enable {p.schoolModeName}</span></label>
        </section>}

        {visible.appearance && <section className="settings-card" id="setting-appearance">
          <h2>Appearance</h2>
          <Segmented<ThemeMode> label="Theme" value={p.theme} onChange={(theme) => updatePreferences({ theme })} values={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'System' }]} />
          <ColorControl label="Accent color" value={p.accent} onChange={(accent) => updatePreferences({ accent })} />
          <Segmented label="Density" value={p.density} onChange={(density) => updatePreferences({ density })} values={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]} />
          <label className="range-field">Text scale <output>{Math.round(p.fontScale * 100)}%</output><input aria-label="Text scale" type="range" min="0.9" max="1.3" step="0.05" value={p.fontScale} onChange={(event) => updatePreferences({ fontScale: Number(event.target.value) })} /></label>
        </section>}

        {visible.navigation && <section className="settings-card" id="setting-navigation">
          <h2>Tab navigation</h2>
          <Segmented<DockEdge> label="Dock edge" value={p.dock} onChange={(dock) => updatePreferences({ dock })} values={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }, { value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom' }]} />
          <p>Pinning, grouping, collapsed groups, order, and dock position persist automatically.</p>
        </section>}
        {visible.vocabulary && <section className="settings-card" id="setting-private-vocabulary"><PrivateVocabularyControl language={p.language} schoolMode={p.schoolMode} /></section>}
        {visibleCount === 0 && <p className="empty-state">No settings match this search.</p>}
      </div>
      <section className="coverage-section">
        <div className="section-heading"><div><span className="eyebrow">Hand-written inventory</span><h2>Current contract coverage</h2></div><p>Foundation marks a meaningful first slice whose deeper contract remains documented as incomplete.</p></div>
        <div className="coverage-table" role="table" aria-label="Feature coverage inventory">
          {coverageInventory.map((item) => <div role="row" key={item.id}><span role="cell" className={`status-chip status-chip--${item.status}`}>{item.status}</span><strong role="cell">{item.label}</strong><code role="cell">{item.evidence}</code></div>)}
        </div>
      </section>
    </div>
  );
}

function NotificationsPage({ state, search, setSearch, dismiss, notify }: { state: PersistedState; search: SearchState; setSearch: (value: SearchState) => void; dismiss: (id: string) => void; notify: (kind: NotificationRecord['kind'], title: string, body: string) => void }) {
  const filtered = state.notifications.filter((item) => matchesSearch(`${item.title} ${item.body} ${item.kind}`, search));
  return (
    <div id="panel-notifications" role="tabpanel" aria-labelledby="tab-notifications" className="page">
      <header className="page-heading"><span className="eyebrow">Reviewable history</span><h1>Notifications</h1><p>Informational messages remain available after their corner notification is dismissed.</p></header>
      <div className="notification-tools">
        <SearchBox label="Notification history" state={search} onChange={setSearch} resultCount={filtered.length} />
        <button type="button" className="tonal-button" onClick={() => notify('success', 'Sample notification', 'This non-blocking message is also recorded in history.')}>Create sample notification</button>
      </div>
      <div className="notification-list">
        {filtered.map((item) => (
          <article key={item.id}>
            <div><span className={`status-chip status-chip--${item.kind}`}>{item.kind}</span><h2>{item.title}</h2><p>{item.body}</p><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></div>
            {!item.dismissed && <button type="button" className="text-button" onClick={() => dismiss(item.id)}>Dismiss corner message</button>}
          </article>
        ))}
        {filtered.length === 0 && <p className="empty-state">No notifications match the active search.</p>}
      </div>
    </div>
  );
}

function AppearanceEditor({ target, value, onChange, onReset, onClose }: { target: string; value: ElementAppearance; onChange: (patch: Partial<ElementAppearance>) => void; onReset: () => void; onClose: () => void }) {
  const [search, setSearch] = useState<SearchState>(emptySearch);
  const fallbackFocusId = target.startsWith('tab:') ? `tab-${target.slice(4)}` : null;
  const openerRef = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const visible = {
    accent: matchesSearch(`Accent color ${value.accent}`, search),
    radius: matchesSearch(`Corner radius shape ${value.radius}`, search),
    emphasis: matchesSearch(`Text emphasis font weight ${value.emphasis}`, search),
    preview: matchesSearch('Live element preview', search),
    reset: matchesSearch('Reset this element defaults', search),
  };
  const visibleCount = Object.values(visible).filter(Boolean).length;

  useEffect(() => () => {
    requestAnimationFrame(() => {
      if (openerRef.current?.isConnected) openerRef.current.focus();
      else if (fallbackFocusId) document.getElementById(fallbackFocusId)?.focus();
    });
  }, [fallbackFocusId]);

  return (
    <section className="appearance-editor floating-panel" role="dialog" aria-label={`Appearance editor for ${target}`} onKeyDown={(event) => event.key === 'Escape' && onClose()}>
      <header><div><span className="eyebrow">Per-element appearance</span><h2>{target.replace(':', ' · ')}</h2></div><button type="button" className="text-button" onClick={onClose}>Close</button></header>
      <SearchBox label="Appearance editor settings" state={search} onChange={setSearch} resultCount={visibleCount} autoFocus />
      {visible.accent && <ColorControl label="Element accent color" value={value.accent} onChange={(accent) => onChange({ accent })} />}
      {visible.radius && <label className="range-field">Corner radius <output>{value.radius}px</output><input aria-label="Corner radius" type="range" min="0" max="32" value={value.radius} onChange={(event) => onChange({ radius: Number(event.target.value) })} /></label>}
      {visible.emphasis && <Segmented label="Text emphasis" value={value.emphasis} onChange={(emphasis) => onChange({ emphasis })} values={[{ value: 'regular', label: 'Regular' }, { value: 'strong', label: 'Strong' }]} />}
      {visible.preview && <div className="appearance-preview" style={appearanceStyle(value)}>Live element preview</div>}
      {visible.reset && <button type="button" className="text-button" onClick={onReset}>Reset this element</button>}
      {visibleCount === 0 && <p className="empty-state">No appearance controls match this search.</p>}
    </section>
  );
}

export { STORAGE_KEY };
