import { useEffect, useMemo, useRef, useState } from 'react';
import type { SystemSummary } from '../shared/contracts';
import { evaluateSearch, type SearchOptions } from './lib/search';

type LanguageMode = 'en' | 'yue' | 'both';
type ThemeMode = 'light' | 'dark';
type TabId = 'overview' | 'install' | 'tweaks' | 'config' | 'updates' | 'microwin' | 'settings';

interface AppSettings {
  displayName: string;
  language: LanguageMode;
  englishFunny: number;
  cantoneseFunny: number;
  showDialogEmoji: boolean;
  theme: ThemeMode;
  density: 'comfortable' | 'compact';
  accent: string;
}

interface NotificationItem {
  id: number;
  title: string;
  body: string;
  tone: 'info' | 'error';
}

interface TabDefinition {
  id: TabId;
  title: string;
  cantoneseTitle: string;
  description: string;
  cantoneseDescription: string;
  status: 'ready' | 'planned';
}

interface PaletteCommand {
  id: string;
  label: string;
  context: string;
  tab: TabId;
  target?: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  displayName: 'Material Tools',
  language: 'en',
  englishFunny: 2,
  cantoneseFunny: 3,
  showDialogEmoji: true,
  theme: 'dark',
  density: 'comfortable',
  accent: '#9dccff',
};

const TABS: TabDefinition[] = [
  { id: 'overview', title: 'Overview', cantoneseTitle: '總覽', description: 'Live, read-only system summary and project status.', cantoneseDescription: '即時唯讀系統摘要同工程狀態。', status: 'ready' },
  { id: 'install', title: 'Install', cantoneseTitle: '安裝', description: 'Application install, upgrade, removal, presets, and package-manager selection.', cantoneseDescription: '應用程式安裝、升級、移除、預設組合，同套件管理器選擇。', status: 'planned' },
  { id: 'tweaks', title: 'Tweaks', cantoneseTitle: '系統調整', description: 'Previewable, reversible registry, service, privacy, and interface changes.', cantoneseDescription: '可預覽同還原嘅登錄、服務、私隱同介面調整。', status: 'planned' },
  { id: 'config', title: 'Config', cantoneseTitle: '設定工具', description: 'Features, repairs, legacy panels, DNS, AppX, and PowerShell profile operations.', cantoneseDescription: '功能、修復、傳統控制台、DNS、AppX 同 PowerShell 設定檔操作。', status: 'planned' },
  { id: 'updates', title: 'Updates', cantoneseTitle: '更新', description: 'Windows Update policy modes with explicit impact and rollback.', cantoneseDescription: '清楚列明影響同還原方法嘅 Windows Update 原則模式。', status: 'planned' },
  { id: 'microwin', title: 'MicroWin', cantoneseTitle: '精簡安裝媒體', description: 'Copy-based ISO inspection and unattended-media creation without modifying originals.', cantoneseDescription: '用副本檢查 ISO 同建立無人值守媒體，唔會改原檔。', status: 'planned' },
  { id: 'settings', title: 'Settings', cantoneseTitle: '設定', description: 'Language, voice, appearance, accessibility, and application identity.', cantoneseDescription: '語言、語氣、外觀、無障礙同應用程式顯示名稱。', status: 'ready' },
];

function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem('material-tools.settings.v1');
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) as Partial<AppSettings> } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function localized(primary: string, secondary: string, mode: LanguageMode): string {
  if (mode === 'yue') return secondary;
  if (mode === 'both') return `${primary} · ${secondary}`;
  return primary;
}

function welcomeCopy(settings: AppSettings): string {
  const english = settings.englishFunny >= 4
    ? 'Your system facts are here. The dangerous buttons are still in quarantine.'
    : settings.englishFunny >= 2
      ? 'Review this device before making changes.'
      : 'System overview.';
  const cantonese = settings.cantoneseFunny >= 4
    ? '系統資料到齊，危險掣仲喺隔離營，未有機會亂嚟。'
    : settings.cantoneseFunny >= 2
      ? '郁手之前先睇清楚部機，唔好同登錄檔鬥快。'
      : '系統總覽。';
  return localized(english, cantonese, settings.language);
}

function formatBytes(value: number): string {
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

function SearchBuilder({ options, onChange }: { options: SearchOptions; onChange: (next: SearchOptions) => void }) {
  return (
    <details className="regex-builder">
      <summary aria-label="Open regular expression builder">.*</summary>
      <div className="popover-surface" aria-label="Regular expression builder">
        <strong>Search mode</strong>
        <label><input type="checkbox" checked={options.regex} onChange={(event) => onChange({ ...options, regex: event.target.checked })} /> Regular expression</label>
        <label><input type="checkbox" checked={options.caseSensitive} onChange={(event) => onChange({ ...options, caseSensitive: event.target.checked })} /> Case sensitive</label>
        <label><input type="checkbox" checked={options.multiline} disabled={!options.regex} onChange={(event) => onChange({ ...options, multiline: event.target.checked })} /> Multiline anchors</label>
        <p>Literals, character classes, anchors, groups, alternation, and quantifiers use the JavaScript RegExp dialect. Evaluation is local and bounded.</p>
      </div>
    </details>
  );
}

function TitleBar({ name }: { name: string }) {
  return (
    <header className="title-bar">
      <div className="title-drag-region" aria-label={`${name} title bar`}><span className="app-mark" aria-hidden="true">M</span><span>{name}</span></div>
      <div className="window-controls" aria-label="Window controls">
        <button type="button" aria-label="Minimize window" onClick={() => window.materialTools.minimizeWindow()}>−</button>
        <button type="button" aria-label="Maximize or restore window" onClick={() => window.materialTools.toggleMaximizeWindow()}>□</button>
        <button type="button" className="close-control" aria-label="Close window" onClick={() => window.materialTools.closeWindow()}>×</button>
      </div>
    </header>
  );
}

function Overview({ settings, summary }: { settings: AppSettings; summary: SystemSummary | null }) {
  if (!summary) return <div className="empty-state" role="status">Reading this device without changing it…</div>;
  const facts = [
    ['Device', summary.hostname],
    ['Windows release', summary.release],
    ['Architecture', summary.architecture],
    ['Processor', `${summary.cpuModel} · ${summary.logicalProcessors} logical processors`],
    ['Memory', `${formatBytes(summary.totalMemoryBytes - summary.freeMemoryBytes)} used of ${formatBytes(summary.totalMemoryBytes)}`],
    ['Elevation', summary.elevated ? 'Administrator session' : 'Standard user session'],
    ['Application version', summary.appVersion],
    ['Build code name', import.meta.env.VITE_RELEASE_CODENAME || 'Local development build'],
  ];
  return (
    <section aria-labelledby="overview-title">
      <div className="section-heading">
        <div><p className="eyebrow">Read-only baseline</p><h1 id="overview-title">{localized('Know the device first', '郁手之前先睇部機', settings.language)}</h1></div>
        <span className="status-chip status-ready">Live</span>
      </div>
      <p className="lede">{welcomeCopy(settings)}</p>
      <dl className="fact-grid">
        {facts.map(([label, value]) => <div className="fact" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <div className="notice info-notice">
        <strong>Foundation boundary</strong>
        <span>This build performs no package, registry, service, update, AppX, or ISO mutations. Each operation will arrive with preview, recovery, cancellation, and audit evidence.</span>
      </div>
    </section>
  );
}

function CapabilityPage({ tab, settings }: { tab: TabDefinition; settings: AppSettings }) {
  return (
    <section aria-labelledby={`${tab.id}-title`}>
      <div className="section-heading">
        <div><p className="eyebrow">WinUtil parity lane</p><h1 id={`${tab.id}-title`}>{localized(tab.title, tab.cantoneseTitle, settings.language)}</h1></div>
        <span className="status-chip status-planned">Not available yet</span>
      </div>
      <p className="lede">{localized(tab.description, tab.cantoneseDescription, settings.language)}</p>
      <div className="empty-state">
        <strong>No executable actions are shipped in this foundation build.</strong>
        <span>The catalog, validation rules, and least-privileged executor for this lane are the next implementation milestone.</span>
        <button type="button" disabled aria-describedby={`${tab.id}-reason`}>Select actions</button>
        <small id={`${tab.id}-reason`}>Unavailable until this lane has verified operation metadata and rollback coverage.</small>
      </div>
    </section>
  );
}

function SettingsPage({ settings, setSettings }: { settings: AppSettings; setSettings: (next: AppSettings) => void }) {
  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => setSettings({ ...settings, [key]: value });
  return (
    <section aria-labelledby="settings-title">
      <div className="section-heading"><div><p className="eyebrow">Persisted locally</p><h1 id="settings-title">Settings</h1></div><span className="status-chip status-ready">Active</span></div>
      <div className="settings-stack">
        <fieldset id="setting-display-name">
          <legend>Application display name</legend>
          <p>Changes labels only. Data folders, package identity, and the update feed never move.</p>
          <div className="field-row"><input value={settings.displayName} maxLength={48} aria-label="Application display name" onChange={(event) => update('displayName', event.target.value || DEFAULT_SETTINGS.displayName)} /><button type="button" onClick={() => update('displayName', DEFAULT_SETTINGS.displayName)}>Reset</button></div>
          <small>Current value comes from this device's local settings; shipped value: Material Tools.</small>
        </fieldset>
        <fieldset id="setting-language">
          <legend>Language mode</legend>
          <p>Choose English, playful Hong Kong-style Cantonese, or a compact bilingual presentation.</p>
          <div className="segmented-control" role="radiogroup" aria-label="Language mode">
            {([['en', 'English'], ['yue', '廣東話'], ['both', 'English · 廣東話']] as const).map(([value, label]) => <button type="button" role="radio" aria-checked={settings.language === value} className={settings.language === value ? 'selected' : ''} key={value} onClick={() => update('language', value)}>{label}</button>)}
          </div>
        </fieldset>
        <fieldset id="setting-funny-levels">
          <legend>Funny levels</legend>
          <p>These levels style all messages, including future warnings and errors. Facts and choices stay exact.</p>
          <label>English: {settings.englishFunny}<input type="range" min="1" max="5" value={settings.englishFunny} onChange={(event) => update('englishFunny', Number(event.target.value))} /></label>
          <label>Cantonese: {settings.cantoneseFunny}<input type="range" min="1" max="5" value={settings.cantoneseFunny} onChange={(event) => update('cantoneseFunny', Number(event.target.value))} /></label>
        </fieldset>
        <fieldset id="setting-appearance">
          <legend>Appearance</legend>
          <p>Theme, density, and accent apply live and persist on this device.</p>
          <div className="field-row"><button type="button" aria-pressed={settings.theme === 'light'} onClick={() => update('theme', 'light')}>Light</button><button type="button" aria-pressed={settings.theme === 'dark'} onClick={() => update('theme', 'dark')}>Dark</button></div>
          <div className="field-row"><button type="button" aria-pressed={settings.density === 'comfortable'} onClick={() => update('density', 'comfortable')}>Comfortable</button><button type="button" aria-pressed={settings.density === 'compact'} onClick={() => update('density', 'compact')}>Compact</button></div>
          <label>Accent color <input type="color" value={settings.accent} onChange={(event) => update('accent', event.target.value)} /></label>
        </fieldset>
        <fieldset id="setting-dialog-emoji">
          <legend>Dialog decoration</legend>
          <label className="switch-row"><input type="checkbox" checked={settings.showDialogEmoji} onChange={(event) => update('showDialogEmoji', event.target.checked)} /><span>Show emojis in dialogs and message boxes</span></label>
          <p>Decoration changes; factual copy and accessible names do not.</p>
        </fieldset>
      </div>
    </section>
  );
}

function CommandPalette({ open, onClose, onNavigate, settings }: { open: boolean; onClose: () => void; onNavigate: (tab: TabId, target?: string) => void; settings: AppSettings }) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<SearchOptions>({ regex: false, caseSensitive: false, multiline: false });
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 0); }, [open]);
  const commands = useMemo<PaletteCommand[]>(() => [
    ...TABS.map((tab) => ({ id: `tab-${tab.id}`, label: `Open ${tab.title}`, context: tab.description, tab: tab.id })),
    { id: 'display-name', label: 'Change application display name', context: 'Settings · Identity', tab: 'settings' as TabId, target: 'setting-display-name' },
    { id: 'language', label: 'Change language mode', context: 'Settings · Language', tab: 'settings' as TabId, target: 'setting-language' },
    { id: 'funny', label: 'Change funny levels', context: 'Settings · Voice', tab: 'settings' as TabId, target: 'setting-funny-levels' },
    { id: 'appearance', label: 'Change appearance', context: 'Settings · Theme and density', tab: 'settings' as TabId, target: 'setting-appearance' },
  ].filter((command) => evaluateSearch(query, `${command.label} ${command.context}`, options).matched), [query, options]);
  if (!open) return null;
  return (
    <div className="palette-scrim" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-labelledby="palette-title">
        <div className="palette-heading"><div><p className="eyebrow">Ctrl+Shift+F</p><h2 id="palette-title">Command palette</h2></div><button type="button" aria-label="Close command palette" onClick={onClose}>×</button></div>
        <div className="search-composite"><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search every destination and setting" aria-label="Command palette search" /><SearchBuilder options={options} onChange={setOptions} /></div>
        <div className="command-results" role="listbox" aria-label={`${commands.length} command results`}>
          {commands.map((command) => <button type="button" role="option" key={command.id} onClick={() => { onNavigate(command.tab, command.target); onClose(); }}><strong>{command.label}</strong><span>{command.context}</span></button>)}
          {commands.length === 0 && <div className="empty-state">No commands match this search.</div>}
        </div>
        <small>{localized('Results open and focus the exact destination.', '結果會直接開同聚焦去準確位置。', settings.language)}</small>
      </section>
    </div>
  );
}

export function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [summary, setSummary] = useState<SystemSummary | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [tabSearch, setTabSearch] = useState('');
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({ regex: false, caseSensitive: false, multiline: false });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => { localStorage.setItem('material-tools.settings.v1', JSON.stringify(settings)); }, [settings]);
  useEffect(() => {
    window.materialTools.getSystemSummary().then(setSummary).catch((error: unknown) => {
      setNotifications([{ id: Date.now(), title: 'System summary failed', body: error instanceof Error ? error.message : 'The read-only system query did not return.', tone: 'error' }]);
    });
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLocaleLowerCase() === 'f') {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (event.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const visibleTabs = TABS.filter((tab) => evaluateSearch(tabSearch, `${tab.title} ${tab.cantoneseTitle} ${tab.description} ${tab.cantoneseDescription}`, searchOptions).matched);
  const current = TABS.find((tab) => tab.id === activeTab) ?? TABS[0];
  const navigate = (tab: TabId, target?: string) => {
    setActiveTab(tab);
    if (target) window.setTimeout(() => document.getElementById(target)?.focus({ preventScroll: false }), 0);
  };

  return (
    <div className="app-shell" data-theme={settings.theme} data-density={settings.density} style={{ '--seed-color': settings.accent } as React.CSSProperties}>
      <TitleBar name={settings.displayName} />
      <div className="workspace">
        <aside className="tab-rail">
          <div className="rail-heading"><strong>{settings.displayName}</strong><button type="button" onClick={() => setPaletteOpen(true)} aria-label="Open command palette">⌕</button></div>
          <div className="search-composite rail-search"><input value={tabSearch} onChange={(event) => setTabSearch(event.target.value)} placeholder="Search tabs" aria-label="Search current tab strip" /><SearchBuilder options={searchOptions} onChange={setSearchOptions} /></div>
          <nav role="tablist" aria-orientation="vertical" aria-label="Primary destinations">
            {visibleTabs.map((tab) => (
              <button type="button" role="tab" aria-selected={activeTab === tab.id} key={tab.id} onClick={() => setActiveTab(tab.id)}>
                <span>{localized(tab.title, tab.cantoneseTitle, settings.language)}</span>
                <span className={`rail-dot ${tab.status}`} aria-label={tab.status === 'ready' ? 'Available' : 'Planned'}></span>
              </button>
            ))}
            {visibleTabs.length === 0 && <p className="rail-empty">No tabs match.</p>}
          </nav>
          <button type="button" className="notification-entry" onClick={() => setActiveTab('overview')}><span>Notifications</span><span>{notifications.length}</span></button>
        </aside>
        <main id={`panel-${current.id}`} role="tabpanel" aria-label={current.title}>
          {activeTab === 'overview' && <Overview settings={settings} summary={summary} />}
          {activeTab === 'settings' && <SettingsPage settings={settings} setSettings={setSettings} />}
          {!['overview', 'settings'].includes(activeTab) && <CapabilityPage tab={current} settings={settings} />}
        </main>
      </div>
      <div className="toast-region" aria-live="polite" aria-label="Notifications">
        {notifications.map((item) => <article className={`toast ${item.tone}`} key={item.id}><div><strong>{item.title}</strong><p>{item.body}</p></div><button type="button" aria-label={`Dismiss ${item.title}`} onClick={() => setNotifications((items) => items.filter((candidate) => candidate.id !== item.id))}>×</button></article>)}
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNavigate={navigate} settings={settings} />
    </div>
  );
}
