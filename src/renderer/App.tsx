import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { APPLICATION_CATALOG, type ApplicationCatalogItem } from '../shared/application-catalog.generated';
import {
  MAX_APPLICATION_CAPABILITY_KEYS,
  type ApplicationCapabilitySnapshot,
  type ApplicationCatalogId,
  type ApplicationInstalledState,
  type ApplicationOperationAction,
  type ApplicationOperationPreview,
  type ApplicationOperationProgress,
  type ApplicationOperationResult,
  type SystemSummary,
} from '../shared/contracts';
import { ACTION_ILLUSTRATION_BINDINGS, type FeaturePageIllustrationId } from './action-illustrations';
import { ActionIllustration } from './components/ActionIllustration';
import { AnchoredRegexBuilder } from './components/AnchoredRegexBuilder';
import {
  applyPrivateVocabulary,
  formatPrivateVocabularyReplacementCount,
  loadPrivateVocabulary,
  parsePrivateVocabulary,
  persistPrivateVocabulary,
  PRIVATE_VOCABULARY_MAX_BYTES,
  type PrivateVocabularyFile,
} from './lib/private-vocabulary';
import { evaluateSearch, MAX_PATTERN_LENGTH, type SearchOptions } from './lib/search';
import { hexToHsl, hslToHex, normalizeEditableHex } from './lib/color-editor';
import { materialThemeCssVariables } from './lib/material-theme';
import { applySetting, type FoundationSettings } from './lib/settings';
import { CAPABILITY_READINESS_LABELS, PLANNED_CAPABILITY_CARDS, type PlannedCapabilityLaneId } from './lib/capability-workspace';
import {
  catalogCategories,
  filterApplicationCatalog,
  MAX_APPLICATION_PLAN_ITEMS,
  mergeCatalogSelection,
  type CatalogSourceFilter,
  type CatalogStatusFilter,
} from './lib/application-catalog-workspace';
import {
  isApplicationOperationPreviewStale,
  summarizeApplicationOperationResult,
  upsertApplicationOperationProgress,
} from './lib/application-operation-workspace';

type LanguageMode = FoundationSettings['language'];
type TabId = FeaturePageIllustrationId;
type AppSettings = FoundationSettings;
type CopyTransform = (value: string) => string;

interface NotificationItem {
  id: number;
  title: string;
  body: string;
  tone: 'info' | 'error';
  reviewed: boolean;
  toastVisible: boolean;
}

interface TabDefinition {
  id: TabId;
  illustrationId: FeaturePageIllustrationId;
  title: string;
  cantoneseTitle: string;
  description: string;
  cantoneseDescription: string;
  status: 'ready' | 'planning';
}

interface PaletteCommand {
  id: string;
  label: string;
  context: string;
  tab?: TabId;
  target?: string;
  action?: 'notifications';
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
  { id: 'overview', illustrationId: ACTION_ILLUSTRATION_BINDINGS.featurePages.overview, title: 'Overview', cantoneseTitle: '總覽', description: 'Live, read-only system summary and project status.', cantoneseDescription: '即時唯讀系統摘要同工程狀態。', status: 'ready' },
  { id: 'install', illustrationId: ACTION_ILLUSTRATION_BINDINGS.featurePages.install, title: 'Install', cantoneseTitle: '安裝', description: 'Search the pinned application catalog, inspect package-manager readiness, and build a review plan.', cantoneseDescription: '搜尋固定版本應用程式目錄、檢視套件管理器準備狀態，同建立審核計劃。', status: 'ready' },
  { id: 'tweaks', illustrationId: ACTION_ILLUSTRATION_BINDINGS.featurePages.tweaks, title: 'Tweaks', cantoneseTitle: '系統調整', description: 'Previewable, reversible registry, service, privacy, and interface changes.', cantoneseDescription: '可預覽同還原嘅登錄、服務、私隱同介面調整。', status: 'planning' },
  { id: 'config', illustrationId: ACTION_ILLUSTRATION_BINDINGS.featurePages.config, title: 'Config', cantoneseTitle: '設定工具', description: 'Features, repairs, legacy panels, DNS, AppX, and PowerShell profile operations.', cantoneseDescription: '功能、修復、傳統控制台、DNS、AppX 同 PowerShell 設定檔操作。', status: 'planning' },
  { id: 'updates', illustrationId: ACTION_ILLUSTRATION_BINDINGS.featurePages.updates, title: 'Updates', cantoneseTitle: '更新', description: 'Windows Update policy modes with explicit impact and rollback.', cantoneseDescription: '清楚列明影響同還原方法嘅 Windows Update 原則模式。', status: 'planning' },
  { id: 'microwin', illustrationId: ACTION_ILLUSTRATION_BINDINGS.featurePages.microwin, title: 'MicroWin', cantoneseTitle: '精簡安裝媒體', description: 'Copy-based ISO inspection and unattended-media creation without modifying originals.', cantoneseDescription: '用副本檢查 ISO 同建立無人值守媒體，唔會改原檔。', status: 'planning' },
  { id: 'settings', illustrationId: ACTION_ILLUSTRATION_BINDINGS.featurePages.settings, title: 'Settings', cantoneseTitle: '設定', description: 'Language, voice, appearance, accessibility, and application identity.', cantoneseDescription: '語言、語氣、外觀、無障礙同應用程式顯示名稱。', status: 'ready' },
];
const APPLICATIONS: readonly ApplicationCatalogItem[] = APPLICATION_CATALOG;
const APPLICATION_KEY_SET = new Set<string>(APPLICATIONS.map((item) => item.key));

function catalogIds(keys: readonly string[]): ApplicationCatalogId[] {
  return keys.filter((key): key is ApplicationCatalogId => APPLICATION_KEY_SET.has(key));
}

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

function AccentColorEditor({ value, onChange, copy, language }: { value: string; onChange: (next: string) => void; copy: CopyTransform; language: LanguageMode }) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<SearchOptions>({ regex: false, caseSensitive: false, multiline: false });
  const [draft, setDraft] = useState(value);
  const hsl = useMemo(() => hexToHsl(value), [value]);
  const sections = {
    hex: evaluateSearch(query, copy('HEX direct color value custom entry'), options),
    hsl: evaluateSearch(query, copy('Hue saturation lightness continuous HSL spectrum'), options),
    preview: evaluateSearch(query, copy('Live accent color preview'), options),
  };
  const visibleCount = Object.values(sections).filter((result) => result.matched).length;
  const searchError = Object.values(sections).find((result) => result.error)?.error ?? null;

  useEffect(() => setDraft(value), [value]);

  const updateHsl = (patch: Partial<typeof hsl>) => onChange(hslToHex({ ...hsl, ...patch }));

  return (
    <section className="accent-color-editor" aria-label={copy('Accent color editor')}>
      <div className="search-composite">
        <input
          type="search"
          value={query}
          maxLength={MAX_PATTERN_LENGTH}
          aria-label={copy('Search accent color controls')}
          aria-invalid={Boolean(searchError)}
          placeholder={copy('Search color controls')}
          onChange={(event) => setQuery(event.target.value)}
        />
        <AnchoredRegexBuilder owner="accent-color-controls" searchLabel="Search accent color controls" query={query} onQueryChange={setQuery} options={options} onOptionsChange={setOptions} copy={copy} language={language} />
      </div>
      <small aria-live="polite">{searchError ?? copy(`${visibleCount} color control sections`)}</small>
      {sections.hex.matched && (
        <label className="accent-color-editor__hex">
          {copy('HEX color')}
          <span className="field-row">
            <span className="accent-color-editor__swatch" style={{ background: value }} aria-hidden="true" />
            <input
              type="text"
              value={draft}
              maxLength={7}
              spellCheck={false}
              aria-label={copy('HEX color value')}
              aria-invalid={normalizeEditableHex(draft) === null}
              onChange={(event) => {
                const next = event.target.value;
                setDraft(next);
                const valid = normalizeEditableHex(next);
                if (valid) onChange(valid);
              }}
            />
          </span>
          {normalizeEditableHex(draft) === null && <small role="alert">{copy('Use six hexadecimal digits, for example #6750a4.')}</small>}
        </label>
      )}
      {sections.hsl.matched && (
        <fieldset className="accent-color-editor__sliders">
          <legend>{copy('Continuous HSL controls')}</legend>
          <label>{copy('Hue')} <output>{hsl.hue}°</output><input type="range" min="0" max="359" value={hsl.hue} aria-label={copy('Hue')} onChange={(event) => updateHsl({ hue: Number(event.target.value) })} /></label>
          <label>{copy('Saturation')} <output>{hsl.saturation}%</output><input type="range" min="0" max="100" value={hsl.saturation} aria-label={copy('Saturation')} onChange={(event) => updateHsl({ saturation: Number(event.target.value) })} /></label>
          <label>{copy('Lightness')} <output>{hsl.lightness}%</output><input type="range" min="0" max="100" value={hsl.lightness} aria-label={copy('Lightness')} onChange={(event) => updateHsl({ lightness: Number(event.target.value) })} /></label>
        </fieldset>
      )}
      {sections.preview.matched && <div className="accent-color-editor__preview" style={{ background: value }} aria-label={copy(`Live accent preview ${value}`)} />}
      {visibleCount === 0 && !searchError && <p className="rail-empty">{copy('No color controls match this search.')}</p>}
    </section>
  );
}

function TitleBar({ name, copy }: { name: string; copy: CopyTransform }) {
  return (
    <header className="title-bar">
      <div className="title-drag-region" aria-label={copy(`${name} title bar`)}><span className="app-mark" aria-hidden="true">M</span><span>{copy(name)}</span></div>
      <div className="window-controls" aria-label={copy('Window controls')}>
        <button type="button" aria-label={copy('Minimize window')} onClick={() => window.materialTools.minimizeWindow()}>−</button>
        <button type="button" aria-label={copy('Maximize or restore window')} onClick={() => window.materialTools.toggleMaximizeWindow()}>□</button>
        <button type="button" className="close-control" aria-label={copy('Close window')} onClick={() => window.materialTools.closeWindow()}>×</button>
      </div>
    </header>
  );
}

function Overview({
  settings,
  summary,
  copy,
  onNavigate,
  capabilitySnapshot,
}: {
  settings: AppSettings;
  summary: SystemSummary | null;
  copy: CopyTransform;
  onNavigate: (tab: TabId) => void;
  capabilitySnapshot: ApplicationCapabilitySnapshot | null;
}) {
  if (!summary) return <div className="empty-state" role="status">{copy('Reading this device without changing it…')}</div>;
  const facts = [
    [copy('Device'), summary.hostname],
    [copy('Windows release'), summary.release],
    [copy('Architecture'), summary.architecture],
    [copy('Processor'), `${summary.cpuModel} · ${summary.logicalProcessors} logical processors`],
    [copy('Memory'), `${formatBytes(summary.totalMemoryBytes - summary.freeMemoryBytes)} used of ${formatBytes(summary.totalMemoryBytes)}`],
    [copy('Elevation'), summary.elevated ? 'Administrator session' : 'Standard user session'],
    [copy('Application version'), summary.appVersion],
    [copy('Build code name'), import.meta.env.VITE_RELEASE_CODENAME || 'Local development build'],
  ];
  const availableManagers = capabilitySnapshot?.managers.filter((manager) => manager.status === 'available').length ?? 0;
  const destinationTabs = TABS.filter((tab) => tab.id !== 'overview');
  return (
    <section aria-labelledby="overview-title">
      <div className="feature-hero overview-hero">
        <div className="feature-hero__copy">
          <div className="section-heading">
            <div><p className="eyebrow">{copy(summary.captureFixture ? 'Documentation capture' : 'Read-only baseline')}</p><h1 id="overview-title">{copy(localized('Know the device first', '郁手之前先睇部機', settings.language))}</h1></div>
            <span className="status-chip status-ready">{copy(summary.captureFixture ? 'Fixture' : 'Live')}</span>
          </div>
          <p className="lede">{copy(summary.captureFixture ? 'This deterministic capture uses non-device-specific values.' : welcomeCopy(settings))}</p>
          <div className="insight-grid" aria-label={copy('Workspace readiness')}>
            <article className="insight-card"><strong>{APPLICATIONS.length}</strong><span>{copy('Pinned application entries')}</span></article>
            <article className="insight-card"><strong>{availableManagers}/2</strong><span>{copy(capabilitySnapshot ? 'Package managers available' : 'Package managers checked')}</span></article>
            <article className="insight-card"><strong>{destinationTabs.length}</strong><span>{copy('Destinations ready to explore')}</span></article>
          </div>
        </div>
        <ActionIllustration id={ACTION_ILLUSTRATION_BINDINGS.featurePages.overview} language={settings.language} copy={copy} loading="eager" />
      </div>

      <section className="destination-section" aria-labelledby="destination-title">
        <div className="subsection-heading"><div><p className="eyebrow">{copy('Choose a workspace')}</p><h2 id="destination-title">{copy(localized('What do you want to review?', '你想檢視邊一項？', settings.language))}</h2></div><span>{copy('Every destination states exactly what works today.')}</span></div>
        <div className="destination-grid">
          {destinationTabs.map((tab) => (
            <article className="destination-card" key={tab.id}>
              <ActionIllustration id={tab.illustrationId} language={settings.language} copy={copy} variant="card" />
              <div className="destination-card__copy">
                <div className="destination-card__heading"><h3>{copy(localized(tab.title, tab.cantoneseTitle, settings.language))}</h3><span className={`status-chip ${tab.status === 'ready' ? 'status-ready' : 'status-planned'}`}>{copy(tab.status === 'ready' ? 'Interactive' : 'Preview')}</span></div>
                <p>{copy(localized(tab.description, tab.cantoneseDescription, settings.language))}</p>
                <button type="button" className="filled-button" onClick={() => onNavigate(tab.id)}>{copy(`Open ${tab.title}`)}</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="subsection-heading system-heading"><div><p className="eyebrow">{copy('Device facts')}</p><h2>{copy('Current read-only snapshot')}</h2></div><span>{copy('No device setting changes while this page loads.')}</span></div>
      <dl className="fact-grid">
        {facts.map(([label, value]) => <div className="fact" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <div className="notice info-notice">
        <strong>{copy('Foundation boundary')}</strong>
        <span>{copy('This build performs no package, registry, service, update, AppX, or ISO mutations. Each operation will arrive with preview, recovery, cancellation, and audit evidence.')}</span>
      </div>
    </section>
  );
}

function PlannedCapabilityPage({ tab, settings, copy }: { tab: TabDefinition; settings: AppSettings; copy: CopyTransform }) {
  const cards = PLANNED_CAPABILITY_CARDS[tab.id as PlannedCapabilityLaneId];
  return (
    <section aria-labelledby={`${tab.id}-title`}>
      <div className="feature-hero">
        <div className="feature-hero__copy">
          <div className="section-heading">
            <div><p className="eyebrow">{copy('WinUtil parity lane')}</p><h1 id={`${tab.id}-title`}>{copy(localized(tab.title, tab.cantoneseTitle, settings.language))}</h1></div>
            <span className="status-chip status-planned">{copy('Preview only')}</span>
          </div>
          <p className="lede">{copy(localized(tab.description, tab.cantoneseDescription, settings.language))}</p>
          <div className="insight-grid" aria-label={copy(`${tab.title} readiness summary`)}>
            <article className="insight-card"><strong>{cards.length}</strong><span>{copy('Workflow areas mapped')}</span></article>
            <article className="insight-card"><strong>0</strong><span>{copy('Executable actions exposed')}</span></article>
            <article className="insight-card"><strong>{copy('Required')}</strong><span>{copy('Preview, verification, and undo')}</span></article>
          </div>
        </div>
        <ActionIllustration id={tab.illustrationId} language={settings.language} copy={copy} />
      </div>

      <div className="subsection-heading"><div><p className="eyebrow">{copy('Mapped workflow')}</p><h2>{copy('What this destination will control')}</h2></div><span>{copy('Cards are factual previews, not controls.')}</span></div>
      <div className="capability-preview-grid">
        {cards.map((card, index) => {
          const readiness = CAPABILITY_READINESS_LABELS[card.readiness];
          return (
            <article className="capability-preview-card" key={card.id}>
              <span className="step-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <div><p className="eyebrow">{copy(localized(readiness.en, readiness.yue, settings.language))}</p><h3>{copy(localized(card.title, card.titleYue, settings.language))}</h3><p>{copy(localized(card.description, card.descriptionYue, settings.language))}</p></div>
            </article>
          );
        })}
      </div>
      <div className="lifecycle-preview" aria-label={copy('Required operation lifecycle')}>
        <article><ActionIllustration id={ACTION_ILLUSTRATION_BINDINGS.surfaces.operationProgress} language={settings.language} copy={copy} variant="card" /><div><h3>{copy('Progress and cancellation')}</h3><p>{copy('Long work must report measured progress where it started and remain cancellable without inventing a finished state.')}</p></div></article>
        <article><ActionIllustration id={ACTION_ILLUSTRATION_BINDINGS.surfaces.operationRecovery} language={settings.language} copy={copy} variant="card" /><div><h3>{copy('Verification and recovery')}</h3><p>{copy('A future apply action stays unavailable until postconditions and an independent recovery path are proven.')}</p></div></article>
      </div>
      <div className="notice warning-notice" id={`${tab.id}-reason`}>
        <strong>{copy('No system action is available from this destination yet.')}</strong>
        <span>{copy('The interface names the intended workflow now, but it will not imitate execution before detection, least-privileged application, verification, cancellation, and recovery are implemented.')}</span>
      </div>
    </section>
  );
}

type CatalogView = 'grid' | 'list';

function InstallWorkspace({
  tab,
  settings,
  copy,
  snapshot,
  capabilityState,
  capabilityError,
  capabilityScannedKeys,
  selectedKeys,
  setSelectedKeys,
  onRefresh,
  onCancel,
  operationAction,
  setOperationAction,
  operationPreview,
  operationProgress,
  operationResult,
  operationState,
  operationError,
  captureFixture,
  onPreviewOperation,
  onExecuteOperation,
  onCancelOperation,
}: {
  tab: TabDefinition;
  settings: AppSettings;
  copy: CopyTransform;
  snapshot: ApplicationCapabilitySnapshot | null;
  capabilityState: 'idle' | 'loading' | 'ready' | 'cancelled' | 'error';
  capabilityError: string | null;
  capabilityScannedKeys: readonly ApplicationCatalogId[];
  selectedKeys: string[];
  setSelectedKeys: Dispatch<SetStateAction<string[]>>;
  onRefresh: (applicationKeys?: readonly ApplicationCatalogId[]) => void;
  onCancel: () => void;
  operationAction: ApplicationOperationAction;
  setOperationAction: Dispatch<SetStateAction<ApplicationOperationAction>>;
  operationPreview: ApplicationOperationPreview | null;
  operationProgress: readonly ApplicationOperationProgress[];
  operationResult: ApplicationOperationResult | null;
  operationState: 'idle' | 'previewing' | 'previewed' | 'executing' | 'finished' | 'error';
  operationError: string | null;
  captureFixture: boolean;
  onPreviewOperation: (action: ApplicationOperationAction, keys: readonly ApplicationCatalogId[]) => void;
  onExecuteOperation: (preview: ApplicationOperationPreview) => void;
  onCancelOperation: (operationId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<SearchOptions>({ regex: false, caseSensitive: false, multiline: false });
  const [category, setCategory] = useState('all');
  const [source, setSource] = useState<CatalogSourceFilter>('all');
  const [status, setStatus] = useState<CatalogStatusFilter>('all');
  const [view, setView] = useState<CatalogView>('grid');
  const [visibleLimit, setVisibleLimit] = useState(36);
  const [planOpen, setPlanOpen] = useState(false);
  const selected = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const detected = useMemo(() => new Map<string, ApplicationInstalledState>(snapshot?.applications.map((application) => [application.id, application]) ?? []), [snapshot]);
  const categories = useMemo(() => catalogCategories(APPLICATIONS), []);
  const filteredCatalog = useMemo(() => filterApplicationCatalog(
    APPLICATIONS,
    { query, options, category, source, status },
    selected,
    detected,
  ), [query, options, category, source, status, selected, detected]);
  const { matches, error: searchError } = filteredCatalog;
  const visibleItems = matches.slice(0, visibleLimit);
  const selectedItems = APPLICATIONS.filter((item) => selected.has(item.key));
  const managerCards = (['winget', 'chocolatey'] as const).map((managerId) => snapshot?.managers.find((manager) => manager.id === managerId) ?? null);

  useEffect(() => setVisibleLimit(36), [query, options, category, source, status]);

  const toggleSelection = (key: string) => setSelectedKeys((current) => {
    if (current.includes(key)) return current.filter((candidate) => candidate !== key);
    return current.length < MAX_APPLICATION_PLAN_ITEMS ? [...current, key] : current;
  });
  const selectMatches = () => setSelectedKeys((current) => mergeCatalogSelection(current, matches));
  const remainingSelectionSlots = MAX_APPLICATION_PLAN_ITEMS - selected.size;
  const checkedAt = snapshot ? new Date(snapshot.checkedAt).toLocaleString() : null;
  const scanScope = catalogIds(selected.size > 0
    ? selectedKeys
    : matches.slice(0, MAX_APPLICATION_CAPABILITY_KEYS).map((item) => item.key));
  const scanScopeLabel = selected.size > 0
    ? `Scan ${scanScope.length} selected application${scanScope.length === 1 ? '' : 's'}`
    : `Scan ${scanScope.length} visible match${scanScope.length === 1 ? '' : 'es'}`;
  const readyPreviewItems = operationPreview?.items.filter((item) => item.readiness === 'ready') ?? [];
  const unavailablePreviewItems = operationPreview?.items.filter((item) => item.readiness === 'unavailable') ?? [];
  const operationResultSummary = operationResult ? summarizeApplicationOperationResult(operationResult) : null;
  const operationBusy = operationState === 'previewing' || operationState === 'executing';
  const selectedCatalogIds = catalogIds(selectedItems.map((item) => item.key));
  const previewStale = isApplicationOperationPreviewStale(operationPreview, operationAction, selectedCatalogIds);

  return (
    <section aria-labelledby="install-title">
      <div className="feature-hero install-hero">
        <div className="feature-hero__copy">
          <div className="section-heading">
            <div><p className="eyebrow">{copy('Pinned WinUtil catalog')}</p><h1 id="install-title">{copy(localized(tab.title, tab.cantoneseTitle, settings.language))}</h1></div>
            <span className="status-chip status-ready">{copy('Catalog interactive')}</span>
          </div>
          <p className="lede">{copy(localized(tab.description, tab.cantoneseDescription, settings.language))}</p>
          <div className="insight-grid" aria-label={copy('Application catalog summary')}>
            <article className="insight-card"><strong>{APPLICATIONS.length}</strong><span>{copy('Pinned catalog entries')}</span></article>
            <article className="insight-card"><strong>{categories.length}</strong><span>{copy('Application categories')}</span></article>
            <article className="insight-card"><strong>{selected.size}/{MAX_APPLICATION_PLAN_ITEMS}</strong><span>{copy('Selected for review')}</span></article>
          </div>
        </div>
        <ActionIllustration id={tab.illustrationId} language={settings.language} copy={copy} loading="eager" />
      </div>

      <section className="manager-section" aria-labelledby="manager-title">
        <div className="subsection-heading"><div><p className="eyebrow">{copy('Read-only detection')}</p><h2 id="manager-title">{copy('Package-manager readiness')}</h2></div><span>{copy(checkedAt ? `Last checked ${checkedAt} · ${detected.size} detected states retained` : 'Not checked yet · startup does not scan automatically')}</span></div>
        <div className="supporting-surface-grid">
          <ActionIllustration id={ACTION_ILLUSTRATION_BINDINGS.surfaces.packageManagerReadiness} language={settings.language} copy={copy} variant="card" loading="eager" />
          <div className="manager-grid">
            {(['WinGet', 'Chocolatey'] as const).map((label, index) => {
              const manager = managerCards[index];
              const managerStatus = capabilityState === 'loading' ? 'Checking' : manager?.status ?? (capabilityState === 'error' ? 'Error' : 'Not checked');
              return (
                <article className="manager-card" key={label}>
                  <div className="manager-card__heading"><h3>{label}</h3><span className={`status-chip manager-status manager-status--${managerStatus.toLocaleLowerCase().replace(' ', '-')}`}>{copy(managerStatus)}</span></div>
                  <strong>{manager?.version ?? copy(manager?.status === 'available' ? 'Available' : 'Version unavailable')}</strong>
                  <p>{copy(manager?.reason ?? (capabilityState === 'loading' ? `Checking package-manager readiness for ${capabilityScannedKeys.length} catalog items without changing packages.` : 'Run the labeled scan to verify whether this manager is available.'))}</p>
                </article>
              );
            })}
          </div>
        </div>
        {capabilityError && <p className="inline-error" role="alert">{copy(capabilityError)}</p>}
        <div className="toolbar-actions">
          <button type="button" className="filled-button" disabled={capabilityState === 'loading' || scanScope.length === 0 || Boolean(searchError)} aria-describedby={capabilityState === 'loading' ? 'manager-refresh-reason' : scanScope.length === 0 ? 'manager-scope-reason' : searchError ? 'manager-search-reason' : undefined} onClick={() => onRefresh(scanScope)}>{copy(scanScopeLabel)}</button>
          {capabilityState === 'loading' && <button type="button" className="tonal-button" onClick={onCancel}>{copy('Cancel detection')}</button>}
          {capabilityState === 'loading' && <small id="manager-refresh-reason">{copy('Refresh is unavailable while detection is already running.')}</small>}
          {scanScope.length === 0 && <small id="manager-scope-reason">{copy('Detection is unavailable because no catalog items match the current filters.')}</small>}
          {searchError && <small id="manager-search-reason">{copy('Detection is unavailable until the catalog search pattern is valid.')}</small>}
        </div>
      </section>

      <section className="catalog-section" aria-labelledby="catalog-title">
        <div className="subsection-heading"><div><p className="eyebrow">{copy('Plan without applying')}</p><h2 id="catalog-title">{copy('Application catalog')}</h2></div><span aria-live="polite">{copy(`${matches.length} matches · ${selected.size} selected`)}</span></div>
        <ActionIllustration id={ACTION_ILLUSTRATION_BINDINGS.surfaces.applicationsCatalog} language={settings.language} copy={copy} variant="card" />
        <div className="catalog-toolbar">
          <div className="search-composite catalog-search">
            <input type="search" value={query} maxLength={MAX_PATTERN_LENGTH} aria-invalid={Boolean(searchError)} onChange={(event) => setQuery(event.target.value)} placeholder={copy('Search names, descriptions, categories, and package IDs')} aria-label={copy('Search application catalog')} />
            <AnchoredRegexBuilder owner="application-catalog" searchLabel="Search application catalog" query={query} onQueryChange={setQuery} options={options} onOptionsChange={setOptions} copy={copy} language={settings.language} />
          </div>
          <small aria-live="polite">{copy(searchError ?? `${matches.length} catalog results`)}</small>
          <div className="filter-group" aria-label={copy('Filter catalog by category')}>
            <span>{copy('Category')}</span>
            <div className="filter-chip-row"><button type="button" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>{copy('All')}</button>{categories.map((value) => <button type="button" aria-pressed={category === value} key={value} onClick={() => setCategory(value)}>{value}</button>)}</div>
          </div>
          <div className="filter-group" aria-label={copy('Filter catalog by package source')}>
            <span>{copy('Source')}</span>
            <div className="filter-chip-row">{([['all', 'All'], ['winget', 'WinGet'], ['chocolatey', 'Chocolatey'], ['foss', 'Open source']] as const).map(([value, label]) => <button type="button" aria-pressed={source === value} key={value} onClick={() => setSource(value)}>{copy(label)}</button>)}</div>
          </div>
          <div className="filter-group" aria-label={copy('Filter catalog by detected status')}>
            <span>{copy('Status')}</span>
            <div className="filter-chip-row">{([['all', 'All'], ['selected', 'Selected'], ['installed', 'Installed'], ['not-installed', 'Not installed'], ['unknown', 'Not detected']] as const).map(([value, label]) => <button type="button" aria-pressed={status === value} key={value} onClick={() => setStatus(value)}>{copy(label)}</button>)}</div>
          </div>
          <div className="catalog-actions">
            <div className="segmented-control" role="group" aria-label={copy('Catalog layout')}><button type="button" aria-pressed={view === 'grid'} onClick={() => setView('grid')}>{copy('Grid')}</button><button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>{copy('List')}</button></div>
            <button type="button" className="tonal-button" disabled={matches.length === 0 || remainingSelectionSlots === 0} aria-describedby="catalog-selection-limit-reason" onClick={selectMatches}>{copy(remainingSelectionSlots === 0 ? 'Selection limit reached' : `Select up to ${Math.min(matches.length, remainingSelectionSlots)} matches`)}</button>
            <button type="button" className="text-button" disabled={selected.size === 0} onClick={() => setSelectedKeys([])}>{copy('Clear selection')}</button>
          </div>
          <small id="catalog-selection-limit-reason">{copy(`A single preview or operation can contain up to ${MAX_APPLICATION_PLAN_ITEMS} applications. Remove an item before adding another when the limit is reached.`)}</small>
        </div>

        {matches.length === 0 && !searchError ? (
          <div className="empty-state"><strong>{copy('No applications match these filters.')}</strong><span>{copy('Clear the search and filters to return to the complete pinned catalog.')}</span><button type="button" onClick={() => { setQuery(''); setCategory('all'); setSource('all'); setStatus('all'); }}>{copy('Clear catalog filters')}</button></div>
        ) : (
          <div className={`application-catalog application-catalog--${view}`} data-view={view}>
            {visibleItems.map((item) => {
              const applicationState = detected.get(item.key);
              const stateLabel = applicationState?.status === 'installed' ? 'Installed' : applicationState?.status === 'not-installed' ? 'Not installed' : 'Not detected';
              const isSelected = selected.has(item.key);
              return (
                <article className={`application-card ${isSelected ? 'application-card--selected' : ''}`} key={item.key}>
                  <div className="application-card__heading"><div><p className="eyebrow">{item.category || 'Uncategorized'}</p><h3>{item.name}</h3></div><span className={`status-chip application-status application-status--${applicationState?.status ?? 'unknown'}`}>{copy(stateLabel)}</span></div>
                  <p className="application-card__description">{item.description}</p>
                  <div className="package-badges" aria-label={copy(`Package sources for ${item.name}`)}>{item.winget.length > 0 && <span>WinGet · {item.winget.length}</span>}{item.choco.length > 0 && <span>Chocolatey · {item.choco.length}</span>}{item.foss && <span>{copy('Open source')}</span>}{item.winget.length === 0 && item.choco.length === 0 && <span>{copy('No supported package ID')}</span>}</div>
                  {applicationState?.version && <small>{copy('Detected version')} · {applicationState.version}</small>}
                  <button type="button" className={isSelected ? 'tonal-button' : 'outlined-button'} aria-pressed={isSelected} disabled={!isSelected && remainingSelectionSlots === 0} aria-describedby={!isSelected && remainingSelectionSlots === 0 ? 'catalog-selection-limit-reason' : undefined} onClick={() => toggleSelection(item.key)}>{copy(isSelected ? 'Remove from review plan' : remainingSelectionSlots === 0 ? 'Plan is full' : 'Add to review plan')}</button>
                </article>
              );
            })}
          </div>
        )}
        {visibleItems.length < matches.length && <button type="button" className="show-more-button" onClick={() => setVisibleLimit((current) => Math.min(current + 36, matches.length))}>{copy(`Show 36 more · ${matches.length - visibleItems.length} remaining`)}</button>}
      </section>

      <section className="review-plan" aria-labelledby="review-plan-title">
        <div className="review-plan__layout"><ActionIllustration id={ACTION_ILLUSTRATION_BINDINGS.surfaces.operationPlan} language={settings.language} copy={copy} variant="card" /><div className="review-plan__summary"><div><p className="eyebrow">{copy('Selection only')}</p><h2 id="review-plan-title">{copy(`${selectedItems.length} applications in the review plan`)}</h2><p>{copy('No package is installed, upgraded, or removed by selecting it here.')}</p></div><button type="button" className="filled-button" disabled={selectedItems.length === 0} aria-expanded={planOpen} aria-controls="review-plan-items" onClick={() => setPlanOpen((open) => !open)}>{copy(planOpen ? 'Hide plan' : 'Preview plan')}</button></div></div>
        {selectedItems.length === 0 && <small>{copy('Preview is unavailable until at least one application is selected.')}</small>}
        {planOpen && selectedItems.length > 0 && <div id="review-plan-items" className="review-plan__items">{selectedItems.map((item) => <article key={item.key}><strong>{item.name}</strong><span>{item.category || 'Uncategorized'}</span><button type="button" className="text-button" onClick={() => toggleSelection(item.key)}>{copy('Remove')}</button></article>)}</div>}
        <div className="notice info-notice"><strong>{copy('Selection does not execute anything.')}</strong><span>{copy('The review list is editable planning state. Use the separate typed operation workspace below to request a fresh preview, confirm it explicitly, watch progress, cancel, and verify the result.')}</span></div>
      </section>
      <section className="operation-workspace" aria-labelledby="operation-workspace-title">
        <div className="subsection-heading"><div><p className="eyebrow">{copy('Typed allowlisted operation')}</p><h2 id="operation-workspace-title">{copy('Preview, confirm, run, and review')}</h2></div><span>{copy('Only catalog keys cross the renderer boundary.')}</span></div>
        {captureFixture && <div className="notice info-notice" role="status"><strong>{copy('Documentation fixture simulation')}</strong><span>{copy('No package-manager command runs in this capture. Preview, progress, cancellation, and result states below exercise the interface only.')}</span></div>}
        <div className="operation-action-row">
          <div className="segmented-control" role="radiogroup" aria-label={copy('Application operation action')}>
            {(['install', 'upgrade'] as const).map((action) => <button type="button" role="radio" aria-checked={operationAction === action} className={operationAction === action ? 'selected' : ''} disabled={operationBusy} key={action} onClick={() => setOperationAction(action)}>{copy(action === 'install' ? 'Install' : 'Upgrade')}</button>)}
          </div>
          <button type="button" className="filled-button" disabled={selectedItems.length === 0 || operationBusy} aria-describedby={selectedItems.length === 0 ? 'operation-selection-reason' : undefined} onClick={() => onPreviewOperation(operationAction, selectedCatalogIds)}>{copy(operationState === 'previewing' ? 'Building preview…' : `Preview ${operationAction} for ${selectedItems.length}`)}</button>
          {selectedItems.length === 0 && <small id="operation-selection-reason">{copy('Choose at least one application before requesting an operation preview.')}</small>}
        </div>
        {operationError && <p className="inline-error" role="alert">{copy(operationError)}</p>}
        {operationPreview && (
          <div className="operation-preview" aria-label={copy(`${operationPreview.action} operation preview`)}>
            <ActionIllustration id={ACTION_ILLUSTRATION_BINDINGS.surfaces.operationPlan} language={settings.language} copy={copy} variant="card" />
            <div>
              <p className="eyebrow">{copy(`Preview created ${new Date(operationPreview.createdAt).toLocaleString()}`)}</p>
              <h3>{copy(`${readyPreviewItems.length} ready · ${unavailablePreviewItems.length} unavailable`)}</h3>
              <p>{copy('Review every item below. The operation starts only after the explicit confirmation button is pressed.')}</p>
              {previewStale && <p className="inline-error" role="alert">{copy('The selection or action changed after this preview. Build a new preview before executing.')}</p>}
              <div className="operation-preview__items">{operationPreview.items.map((item) => <article key={item.applicationId}><strong>{item.name}</strong><span>{item.manager ?? copy('No package manager')}</span><span className={`status-chip ${item.readiness === 'ready' ? 'status-ready' : 'status-planned'}`}>{copy(item.readiness === 'ready' ? 'Ready' : 'Unavailable')}</span>{item.reason && <small>{copy(item.reason)}</small>}</article>)}</div>
              <button type="button" className="filled-button" disabled={operationState !== 'previewed' || readyPreviewItems.length === 0 || previewStale} onClick={() => onExecuteOperation(operationPreview)}>{copy(`Confirm and ${operationPreview.action} ${readyPreviewItems.length} ready application${readyPreviewItems.length === 1 ? '' : 's'}`)}</button>
            </div>
          </div>
        )}
        {(operationState === 'executing' || operationProgress.length > 0) && (
          <div className="operation-progress" aria-label={copy('Application operation progress')}>
            <ActionIllustration id={ACTION_ILLUSTRATION_BINDINGS.surfaces.operationProgress} language={settings.language} copy={copy} variant="card" />
            <div><div className="operation-progress__heading"><div><p className="eyebrow">{copy(operationState === 'executing' ? 'Operation in progress' : 'Latest operation progress')}</p><h3>{copy(operationProgress.length > 0 ? `${Math.max(...operationProgress.map((item) => item.completedCount))}/${Math.max(...operationProgress.map((item) => item.totalCount))} complete` : 'Starting operation')}</h3></div>{operationState === 'executing' && operationPreview && <button type="button" className="tonal-button" onClick={() => onCancelOperation(operationPreview.operationId)}>{copy('Cancel operation')}</button>}</div><div className="operation-progress__items">{operationProgress.map((item) => <article key={item.applicationId}><strong>{item.name}</strong><span>{copy(item.message)}</span><span className={`status-chip operation-state--${item.state}`}>{copy(item.state)}</span></article>)}</div></div>
          </div>
        )}
        {operationResult && operationResultSummary && (
          <div className={`operation-result operation-result--${operationResult.state}`} role="status">
            <ActionIllustration id={ACTION_ILLUSTRATION_BINDINGS.surfaces.operationRecovery} language={settings.language} copy={copy} variant="card" />
            <div><p className="eyebrow">{copy(captureFixture ? `Fixture simulation ${operationResult.state}` : `Operation ${operationResult.state}`)}</p><h3>{copy(`${operationResultSummary.succeeded} succeeded · ${operationResultSummary.failed} failed · ${operationResultSummary.cancelled} cancelled · ${operationResultSummary.unavailable} unavailable`)}</h3><p>{copy(`Started ${new Date(operationResult.startedAt).toLocaleString()} · finished ${new Date(operationResult.completedAt).toLocaleString()}`)}</p><div className="operation-result__items">{operationResult.items.map((item) => <article key={item.applicationId}><strong>{item.name}</strong><span className={`status-chip operation-state--${item.state}`}>{copy(item.state)}</span>{item.reason && <small>{copy(item.reason)}</small>}</article>)}</div><button type="button" className="tonal-button" onClick={() => onRefresh(catalogIds(operationResult.items.map((item) => item.applicationId)))}>{copy(`Verify ${operationResult.items.length} result${operationResult.items.length === 1 ? '' : 's'} with a new scan`)}</button></div>
          </div>
        )}
      </section>
    </section>
  );
}

function SettingsPage({
  settings,
  setSettings,
  vocabulary,
  setVocabulary,
  notify,
  copy,
}: {
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
  vocabulary: PrivateVocabularyFile | null;
  setVocabulary: (next: PrivateVocabularyFile | null) => void;
  notify: (title: string, body: string, tone?: NotificationItem['tone']) => void;
  copy: CopyTransform;
}) {
  const [settingsQuery, setSettingsQuery] = useState('');
  const [settingsSearchOptions, setSettingsSearchOptions] = useState<SearchOptions>({ regex: false, caseSensitive: false, multiline: false });
  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => setSettings((current) => applySetting(current, key, value));
  const settingsSections = {
    displayName: evaluateSearch(settingsQuery, copy('Application display name identity rename reset package data folder'), settingsSearchOptions),
    language: evaluateSearch(settingsQuery, copy('Language mode English Cantonese bilingual'), settingsSearchOptions),
    funnyLevels: evaluateSearch(settingsQuery, copy('Funny levels English Cantonese voice warnings errors'), settingsSearchOptions),
    appearance: evaluateSearch(settingsQuery, copy('Appearance theme density accent color light dark comfortable compact'), settingsSearchOptions),
    dialogEmoji: evaluateSearch(settingsQuery, copy('Dialog decoration emojis dialogs message boxes'), settingsSearchOptions),
    privateVocabulary: evaluateSearch(settingsQuery, copy('Private vocabulary JSON local upload clear wording'), settingsSearchOptions),
  };
  const visibleSettingsCount = Object.values(settingsSections).filter((result) => result.matched).length;
  const settingsSearchError = Object.values(settingsSections).find((result) => result.error)?.error ?? null;
  const uploadVocabulary = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      if (file.size > PRIVATE_VOCABULARY_MAX_BYTES) throw new Error('The selected file is larger than 64 KiB.');
      const next = parsePrivateVocabulary(await file.text());
      setVocabulary(next);
      notify('Private vocabulary loaded', formatPrivateVocabularyReplacementCount(Object.keys(next.replacements).length));
    } catch (error) {
      notify('Private vocabulary was not loaded', error instanceof Error ? error.message : 'The selected file could not be validated.', 'error');
    }
  };
  return (
    <section aria-labelledby="settings-title">
      <div className="feature-hero settings-hero">
        <div className="feature-hero__copy"><div className="section-heading"><div><p className="eyebrow">{copy('Persisted locally')}</p><h1 id="settings-title">{copy('Settings')}</h1></div><span className="status-chip status-ready">{copy('Active')}</span></div><p className="lede">{copy('Tune language, voice, appearance, dialog decoration, application identity, and private local wording. Changes apply live.')}</p><div className="insight-grid" aria-label={copy('Current settings summary')}><article className="insight-card"><strong>{copy(settings.theme === 'dark' ? 'Dark' : 'Light')}</strong><span>{copy('Theme')}</span></article><article className="insight-card"><strong>{copy(settings.density === 'compact' ? 'Compact' : 'Comfortable')}</strong><span>{copy('Density')}</span></article><article className="insight-card"><strong>{copy(localized('English', '廣東話', settings.language))}</strong><span>{copy('Language presentation')}</span></article></div></div>
        <ActionIllustration id={ACTION_ILLUSTRATION_BINDINGS.featurePages.settings} language={settings.language} copy={copy} />
      </div>
      <section className="settings-search" aria-labelledby="settings-search-title">
        <div className="subsection-heading"><div><p className="eyebrow">{copy('Find a control')}</p><h2 id="settings-search-title">{copy('Search this settings surface')}</h2></div><span aria-live="polite">{copy(settingsSearchError ?? `${visibleSettingsCount} setting sections`)}</span></div>
        <div className="search-composite"><input type="search" value={settingsQuery} maxLength={MAX_PATTERN_LENGTH} aria-invalid={Boolean(settingsSearchError)} onChange={(event) => setSettingsQuery(event.target.value)} placeholder={copy('Search labels, explanations, and current values')} aria-label={copy('Search settings')} /><AnchoredRegexBuilder owner="settings-surface" searchLabel="Search settings" query={settingsQuery} onQueryChange={setSettingsQuery} options={settingsSearchOptions} onOptionsChange={setSettingsSearchOptions} copy={copy} language={settings.language} /></div>
      </section>
      <div className="settings-stack">
        <fieldset id="setting-display-name" hidden={!settingsSections.displayName.matched}>
          <legend>{copy('Application display name')}</legend>
          <p>{copy('Changes labels only. Data folders, package identity, and the update feed never move.')}</p>
          <div className="field-row"><input value={settings.displayName} maxLength={48} aria-label={copy('Application display name')} onChange={(event) => update('displayName', event.target.value || DEFAULT_SETTINGS.displayName)} /><button type="button" onClick={() => update('displayName', DEFAULT_SETTINGS.displayName)}>{copy('Reset')}</button></div>
          <small>{copy("Current value comes from this device's local settings; shipped value: Material Tools.")}</small>
        </fieldset>
        <fieldset id="setting-language" hidden={!settingsSections.language.matched}>
          <legend>{copy('Language mode')}</legend>
          <p>{copy('Choose English, playful Hong Kong-style Cantonese, or a compact bilingual presentation.')}</p>
          <div className="segmented-control" role="radiogroup" aria-label={copy('Language mode')}>
            {([['en', 'English'], ['yue', '廣東話'], ['both', 'English · 廣東話']] as const).map(([value, label]) => <button type="button" role="radio" aria-checked={settings.language === value} className={settings.language === value ? 'selected' : ''} key={value} onClick={() => update('language', value)}>{copy(label)}</button>)}
          </div>
        </fieldset>
        <fieldset id="setting-funny-levels" hidden={!settingsSections.funnyLevels.matched}>
          <legend>{copy('Funny levels')}</legend>
          <p>{copy('These levels style all messages, including future warnings and errors. Facts and choices stay exact.')}</p>
          <label>{copy(`English: ${settings.englishFunny}`)}<input type="range" min="1" max="5" value={settings.englishFunny} onChange={(event) => update('englishFunny', Number(event.target.value))} /></label>
          <label>{copy(`Cantonese: ${settings.cantoneseFunny}`)}<input type="range" min="1" max="5" value={settings.cantoneseFunny} onChange={(event) => update('cantoneseFunny', Number(event.target.value))} /></label>
        </fieldset>
        <fieldset id="setting-appearance" hidden={!settingsSections.appearance.matched}>
          <legend>{copy('Appearance')}</legend>
          <p>{copy('Theme, density, and accent apply live and persist on this device.')}</p>
          <div className="field-row"><button type="button" aria-pressed={settings.theme === 'light'} onClick={() => update('theme', 'light')}>{copy('Light')}</button><button type="button" aria-pressed={settings.theme === 'dark'} onClick={() => update('theme', 'dark')}>{copy('Dark')}</button></div>
          <div className="field-row"><button type="button" aria-pressed={settings.density === 'comfortable'} onClick={() => update('density', 'comfortable')}>{copy('Comfortable')}</button><button type="button" aria-pressed={settings.density === 'compact'} onClick={() => update('density', 'compact')}>{copy('Compact')}</button></div>
          <AccentColorEditor value={settings.accent} onChange={(accent) => update('accent', accent)} copy={copy} language={settings.language} />
        </fieldset>
        <fieldset id="setting-dialog-emoji" hidden={!settingsSections.dialogEmoji.matched}>
          <legend>{copy('Dialog decoration')}</legend>
          <label className="switch-row"><input type="checkbox" checked={settings.showDialogEmoji} onChange={(event) => update('showDialogEmoji', event.target.checked)} /><span>{copy('Show emojis in dialogs and message boxes')}</span></label>
          <p>{copy('Decoration changes; factual copy and accessible names do not.')}</p>
        </fieldset>
        <fieldset id="setting-private-vocabulary" hidden={!settingsSections.privateVocabulary.matched}>
          <legend>{copy('Private vocabulary')}</legend>
          <ActionIllustration id={ACTION_ILLUSTRATION_BINDINGS.surfaces.privateVocabulary} language={settings.language} copy={copy} variant="setting" />
          <p id="private-vocabulary-help">{copy('Upload a versioned JSON file to replace approved user-interface wording locally. The file is validated in this app, cached only in local browser storage, and never sent over the network, logged, exported, or copied into the application package.')}</p>
          <label>{copy('Choose private vocabulary JSON')}
            <input type="file" accept=".json,application/json" aria-describedby="private-vocabulary-help private-vocabulary-status" onChange={(event) => { void uploadVocabulary(event); }} />
          </label>
          <small id="private-vocabulary-status">{copy(vocabulary ? formatPrivateVocabularyReplacementCount(Object.keys(vocabulary.replacements).length) : 'No private vocabulary is loaded; shipped wording is unchanged.')}</small>
          <div className="field-row">
            <button type="button" disabled={!vocabulary} aria-describedby={!vocabulary ? 'private-vocabulary-clear-reason' : undefined} onClick={() => {
              try {
                setVocabulary(null);
                notify('Private vocabulary cleared', 'Shipped wording is active again.');
              } catch (error) {
                notify('Private vocabulary was not cleared', error instanceof Error ? error.message : 'The local cache could not be cleared.', 'error');
              }
            }}>{copy('Clear local vocabulary')}</button>
          </div>
          {!vocabulary && <small id="private-vocabulary-clear-reason">{copy('Clear is unavailable because no private vocabulary is loaded.')}</small>}
        </fieldset>
        {visibleSettingsCount === 0 && !settingsSearchError && <div className="empty-state"><strong>{copy('No settings match this search.')}</strong><span>{copy('Clear the search to show all six setting sections again.')}</span><button type="button" onClick={() => setSettingsQuery('')}>{copy('Clear settings search')}</button></div>}
      </div>
    </section>
  );
}

function CommandPalette({ open, onClose, onNavigate, onOpenNotifications, settings, copy }: { open: boolean; onClose: (restoreFocus?: boolean) => void; onNavigate: (tab: TabId, target?: string) => void; onOpenNotifications: () => void; settings: AppSettings; copy: CopyTransform }) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<SearchOptions>({ regex: false, caseSensitive: false, multiline: false });
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 0); }, [open]);
  const availableCommands = useMemo<PaletteCommand[]>(() => [
    ...TABS.map((tab) => ({ id: `tab-${tab.id}`, label: copy(`Open ${tab.title}`), context: copy(tab.description), tab: tab.id })),
    { id: 'display-name', label: copy('Change application display name'), context: copy('Settings · Identity'), tab: 'settings' as TabId, target: 'setting-display-name' },
    { id: 'language', label: copy('Change language mode'), context: copy('Settings · Language'), tab: 'settings' as TabId, target: 'setting-language' },
    { id: 'funny', label: copy('Change funny levels'), context: copy('Settings · Voice'), tab: 'settings' as TabId, target: 'setting-funny-levels' },
    { id: 'appearance', label: copy('Change appearance'), context: copy('Settings · Theme and density'), tab: 'settings' as TabId, target: 'setting-appearance' },
    { id: 'private-vocabulary', label: copy('Upload private vocabulary'), context: copy('Settings · Local language customization'), tab: 'settings' as TabId, target: 'setting-private-vocabulary' },
    { id: 'notifications', label: copy('Open notification center'), context: copy('Review and dismiss application messages'), action: 'notifications' as const },
  ], [copy]);
  const evaluatedCommands = availableCommands.map((command) => ({ command, result: evaluateSearch(query, `${command.label} ${command.context}`, options) }));
  const searchError = evaluatedCommands.find(({ result }) => result.error)?.result.error ?? null;
  const commands = evaluatedCommands.filter(({ result }) => result.matched).map(({ command }) => command);
  if (!open) return null;
  return (
    <div className="palette-scrim" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-labelledby="palette-title">
        <div className="palette-heading"><div><p className="eyebrow">Ctrl+Shift+F</p><h2 id="palette-title">{copy('Command palette')} {settings.showDialogEmoji && <span className="dialog-decoration" aria-hidden="true">🧭</span>}</h2></div><button type="button" aria-label={copy('Close command palette')} onClick={() => onClose()}>×</button></div>
        <ActionIllustration id={ACTION_ILLUSTRATION_BINDINGS.surfaces.commandPalette} language={settings.language} copy={copy} variant="dialog" loading="eager" />
        <div className="search-composite"><input ref={inputRef} type="search" value={query} maxLength={MAX_PATTERN_LENGTH} aria-invalid={Boolean(searchError)} onChange={(event) => setQuery(event.target.value)} placeholder={copy('Search every destination and setting')} aria-label={copy('Command palette search')} /><AnchoredRegexBuilder owner="command-palette" searchLabel="Command palette search" query={query} onQueryChange={setQuery} options={options} onOptionsChange={setOptions} copy={copy} language={settings.language} /></div>
        <small aria-live="polite">{copy(searchError ?? `${commands.length} command results`)}</small>
        <div className="command-results" role="listbox" aria-label={copy(`${commands.length} command results`)}>
          {commands.map((command) => <button type="button" role="option" key={command.id} onClick={() => { if (command.action === 'notifications') onOpenNotifications(); else if (command.tab) onNavigate(command.tab, command.target); onClose(false); }}><strong>{command.label}</strong><span>{command.context}</span></button>)}
          {commands.length === 0 && !searchError && <div className="empty-state">{copy('No commands match this search.')}</div>}
        </div>
        <small>{copy(localized('Results open and focus the exact destination.', '結果會直接開同聚焦去準確位置。', settings.language))}</small>
      </section>
    </div>
  );
}

function NotificationCenter({
  open,
  notifications,
  settings,
  copy,
  onClose,
  onReview,
  onReviewVisible,
}: {
  open: boolean;
  notifications: NotificationItem[];
  settings: AppSettings;
  copy: CopyTransform;
  onClose: () => void;
  onReview: (id: number) => void;
  onReviewVisible: (ids: number[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<SearchOptions>({ regex: false, caseSensitive: false, multiline: false });
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 0); }, [open]);
  const results = notifications.map((notification) => ({ notification, result: evaluateSearch(query, copy(`${notification.title} ${notification.body} ${notification.tone}`), options) }));
  const searchError = results.find(({ result }) => result.error)?.result.error ?? null;
  const visible = results.filter(({ result }) => result.matched).map(({ notification }) => notification);
  const visibleUnreviewed = visible.filter((notification) => !notification.reviewed);
  if (!open) return null;
  return (
    <div className="dialog-scrim" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="notification-center" role="dialog" aria-modal="true" aria-labelledby="notification-center-title">
        <div className="dialog-heading"><div><p className="eyebrow">{copy('Reviewable history')}</p><h2 id="notification-center-title">{copy('Notification center')} {settings.showDialogEmoji && <span className="dialog-decoration" aria-hidden="true">🔔</span>}</h2></div><button type="button" className="icon-button" aria-label={copy('Close notification center')} onClick={onClose}>×</button></div>
        <ActionIllustration id={ACTION_ILLUSTRATION_BINDINGS.surfaces.notifications} language={settings.language} copy={copy} variant="dialog" loading="eager" />
        <div className="search-composite"><input ref={inputRef} type="search" value={query} maxLength={MAX_PATTERN_LENGTH} aria-invalid={Boolean(searchError)} onChange={(event) => setQuery(event.target.value)} placeholder={copy('Search notification title, message, or tone')} aria-label={copy('Search notifications')} /><AnchoredRegexBuilder owner="notification-center" searchLabel="Search notifications" query={query} onQueryChange={setQuery} options={options} onOptionsChange={setOptions} copy={copy} language={settings.language} /></div>
        <div className="notification-center__toolbar"><span aria-live="polite">{copy(searchError ?? `${visible.length} visible · ${visibleUnreviewed.length} not reviewed`)}</span><button type="button" className="tonal-button" disabled={visibleUnreviewed.length === 0} onClick={() => onReviewVisible(visibleUnreviewed.map((notification) => notification.id))}>{copy(visibleUnreviewed.length === 0 ? 'All visible notifications reviewed' : `Mark ${visibleUnreviewed.length} visible reviewed`)}</button></div>
        <div className="notification-center__list" aria-label={copy('Notification history')}>
          {visible.map((notification) => <article className={`notification-card ${notification.tone} ${notification.reviewed ? 'reviewed' : ''}`} key={notification.id}><div><strong>{copy(notification.title)}</strong><p>{copy(notification.body)}</p></div>{notification.reviewed ? <span className="status-chip">{copy('Reviewed')}</span> : <button type="button" className="text-button" aria-label={copy(`Mark ${notification.title} reviewed`)} onClick={() => onReview(notification.id)}>{copy('Mark reviewed')}</button>}</article>)}
          {visible.length === 0 && !searchError && <div className="empty-state"><strong>{copy(notifications.length === 0 ? 'No notifications yet.' : 'No notifications match this search.')}</strong><span>{copy(notifications.length === 0 ? 'Errors and completed local actions will appear here without interrupting your work.' : 'Clear the search to return to the complete notification history.')}</span>{notifications.length > 0 && <button type="button" onClick={() => setQuery('')}>{copy('Clear notification search')}</button>}</div>}
        </div>
      </section>
    </div>
  );
}

export function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [vocabulary, setVocabularyState] = useState(loadPrivateVocabulary);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [summary, setSummary] = useState<SystemSummary | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteOriginRef = useRef<HTMLElement | null>(null);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [tabSearch, setTabSearch] = useState('');
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({ regex: false, caseSensitive: false, multiline: false });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const nextNotificationId = useRef(0);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const [capabilitySnapshot, setCapabilitySnapshot] = useState<ApplicationCapabilitySnapshot | null>(null);
  const [capabilityState, setCapabilityState] = useState<'idle' | 'loading' | 'ready' | 'cancelled' | 'error'>('idle');
  const [capabilityError, setCapabilityError] = useState<string | null>(null);
  const [capabilityScannedKeys, setCapabilityScannedKeys] = useState<ApplicationCatalogId[]>([]);
  const [selectedApplicationKeys, setSelectedApplicationKeys] = useState<string[]>([]);
  const [applicationOperationAction, setApplicationOperationAction] = useState<ApplicationOperationAction>('install');
  const [applicationOperationPreview, setApplicationOperationPreview] = useState<ApplicationOperationPreview | null>(null);
  const [applicationOperationProgress, setApplicationOperationProgress] = useState<ApplicationOperationProgress[]>([]);
  const [applicationOperationResult, setApplicationOperationResult] = useState<ApplicationOperationResult | null>(null);
  const [applicationOperationState, setApplicationOperationState] = useState<'idle' | 'previewing' | 'previewed' | 'executing' | 'finished' | 'error'>('idle');
  const [applicationOperationError, setApplicationOperationError] = useState<string | null>(null);
  const copy = useCallback((value: string) => applyPrivateVocabulary(value, vocabulary), [vocabulary]);
  const notify = useCallback((title: string, body: string, tone: NotificationItem['tone'] = 'info') => {
    nextNotificationId.current += 1;
    const id = Date.now() * 100 + nextNotificationId.current;
    setNotifications((items) => [...items, { id, title, body, tone, reviewed: false, toastVisible: true }]);
    if (tone === 'info') {
      window.setTimeout(() => setNotifications((items) => items.map((item) => item.id === id ? { ...item, toastVisible: false } : item)), 6_000);
    }
  }, []);
  const closeNotificationCenter = useCallback(() => {
    setNotificationCenterOpen(false);
    window.setTimeout(() => notificationButtonRef.current?.focus(), 0);
  }, []);
  const openPalette = useCallback(() => {
    paletteOriginRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPaletteOpen(true);
  }, []);
  const closePalette = useCallback((restoreFocus = true) => {
    setPaletteOpen(false);
    if (restoreFocus) window.setTimeout(() => paletteOriginRef.current?.focus(), 0);
  }, []);
  const markNotificationsReviewed = useCallback((ids: readonly number[]) => {
    const reviewedIds = new Set(ids);
    setNotifications((items) => items.map((item) => reviewedIds.has(item.id) ? { ...item, reviewed: true, toastVisible: false } : item));
  }, []);
  const previewApplicationOperation = useCallback((action: ApplicationOperationAction, applicationKeys: readonly ApplicationCatalogId[]) => {
    setApplicationOperationAction(action);
    setApplicationOperationState('previewing');
    setApplicationOperationError(null);
    setApplicationOperationProgress([]);
    setApplicationOperationResult(null);
    setApplicationOperationPreview(null);
    window.materialTools.previewApplicationOperation(action, applicationKeys).then((preview) => {
      setApplicationOperationPreview(preview);
      setApplicationOperationState('previewed');
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'The operation preview did not return.';
      setApplicationOperationError(message);
      setApplicationOperationState('error');
      notify('Application operation preview failed', message, 'error');
    });
  }, [notify]);
  const executeApplicationOperation = useCallback((preview: ApplicationOperationPreview) => {
    setApplicationOperationState('executing');
    setApplicationOperationError(null);
    setApplicationOperationProgress([]);
    setApplicationOperationResult(null);
    window.materialTools.executeApplicationOperation(preview.operationId, preview.planToken).then((result) => {
      setApplicationOperationResult(result);
      setApplicationOperationState('finished');
      const resultSummary = summarizeApplicationOperationResult(result);
      notify(
        summary?.captureFixture ? `Fixture operation ${result.state}` : `Application operation ${result.state}`,
        summary?.captureFixture
          ? `Interface simulation only; no package-manager command ran. ${resultSummary.succeeded} succeeded, ${resultSummary.failed} failed, ${resultSummary.cancelled} cancelled, and ${resultSummary.unavailable} unavailable.`
          : `${resultSummary.succeeded} succeeded, ${resultSummary.failed} failed, ${resultSummary.cancelled} cancelled, and ${resultSummary.unavailable} unavailable.`,
        result.state === 'completed' ? 'info' : 'error',
      );
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'The application operation did not return.';
      setApplicationOperationError(message);
      setApplicationOperationState('error');
      notify('Application operation failed', message, 'error');
    });
  }, [notify, summary]);
  const updateVocabulary = useCallback((next: PrivateVocabularyFile | null) => {
    persistPrivateVocabulary(next);
    setVocabularyState(next);
  }, []);
  const refreshAppCapabilities = useCallback((applicationKeys?: readonly ApplicationCatalogId[]) => {
    setCapabilityState('loading');
    setCapabilityError(null);
    setCapabilityScannedKeys([...(applicationKeys ?? [])]);
    window.materialTools.getAppCapabilities(applicationKeys).then((next) => {
      setCapabilitySnapshot((current) => {
        if (!current || !applicationKeys) return next;
        const applications = new Map<string, ApplicationInstalledState>(current.applications.map((application) => [application.id, application]));
        for (const application of next.applications) applications.set(application.id, application);
        return { ...next, applications: [...applications.values()] };
      });
      setCapabilityState(next.state === 'cancelled' ? 'cancelled' : 'ready');
      if (next.state === 'cancelled') notify('Readiness scan cancelled', `${next.applications.length} returned application states were retained.`);
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Package-manager detection did not return.';
      setCapabilityError(message);
      setCapabilityState('error');
      notify('Application readiness failed', message, 'error');
    });
  }, [notify]);

  useEffect(() => { localStorage.setItem('material-tools.settings.v1', JSON.stringify(settings)); }, [settings]);
  useEffect(() => {
    window.materialTools.getSystemSummary().then(setSummary).catch((error: unknown) => {
      notify('System summary failed', error instanceof Error ? error.message : 'The read-only system query did not return.', 'error');
    });
  }, [notify]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLocaleLowerCase() === 'f') {
        event.preventDefault();
        openPalette();
      }
      if (event.key === 'Escape' && !event.defaultPrevented) {
        closePalette();
        closeNotificationCenter();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeNotificationCenter, closePalette, openPalette]);
  useEffect(() => window.materialTools.onApplicationOperationProgress((progress) => {
    setApplicationOperationProgress((current) => upsertApplicationOperationProgress(current, progress));
  }), []);

  const visibleTabs = TABS.filter((tab) => evaluateSearch(tabSearch, copy(`${tab.title} ${tab.cantoneseTitle} ${tab.description} ${tab.cantoneseDescription}`), searchOptions).matched);
  const current = TABS.find((tab) => tab.id === activeTab) ?? TABS[0];
  const themeVariables = useMemo(
    () => materialThemeCssVariables(settings.accent, settings.theme === 'dark'),
    [settings.accent, settings.theme],
  );
  const navigate = (tab: TabId, target?: string) => {
    setActiveTab(tab);
    window.setTimeout(() => document.getElementById(target ?? `panel-${tab}`)?.focus({ preventScroll: false }), 0);
  };

  return (
    <div className="app-shell" data-theme={settings.theme} data-density={settings.density} style={themeVariables as React.CSSProperties}>
      <TitleBar name={settings.displayName} copy={copy} />
      <div className="workspace">
        <aside className="tab-rail">
          <div className="rail-heading"><strong>{copy(settings.displayName)}</strong><button type="button" onClick={openPalette} aria-label={copy('Open command palette')}>⌕</button></div>
          <div className="search-composite rail-search"><input type="search" value={tabSearch} maxLength={MAX_PATTERN_LENGTH} onChange={(event) => setTabSearch(event.target.value)} placeholder={copy('Search tabs')} aria-label={copy('Search current tab strip')} /><AnchoredRegexBuilder owner="current-tab-strip" searchLabel="Search current tab strip" query={tabSearch} onQueryChange={setTabSearch} options={searchOptions} onOptionsChange={setSearchOptions} copy={copy} language={settings.language} /></div>
          <nav role="tablist" aria-orientation="vertical" aria-label={copy('Primary destinations')}>
            {visibleTabs.map((tab) => (
              <button type="button" role="tab" aria-selected={activeTab === tab.id} key={tab.id} onClick={() => setActiveTab(tab.id)}>
                <span>{copy(localized(tab.title, tab.cantoneseTitle, settings.language))}</span>
                <span className={`rail-dot ${tab.status}`} aria-label={copy(tab.status === 'ready' ? 'Available' : 'Planning preview')}></span>
              </button>
            ))}
            {visibleTabs.length === 0 && <p className="rail-empty">{copy('No tabs match.')}</p>}
          </nav>
          <button ref={notificationButtonRef} type="button" className="notification-entry" aria-haspopup="dialog" onClick={() => setNotificationCenterOpen(true)}><span>{copy('Notifications')}</span><span>{notifications.filter((notification) => !notification.reviewed).length}</span></button>
        </aside>
        <main id={`panel-${current.id}`} role="tabpanel" tabIndex={-1} aria-label={copy(current.title)}>
          {activeTab === 'overview' && <Overview settings={settings} summary={summary} copy={copy} onNavigate={navigate} capabilitySnapshot={capabilitySnapshot} />}
          {activeTab === 'install' && <InstallWorkspace tab={current} settings={settings} copy={copy} snapshot={capabilitySnapshot} capabilityState={capabilityState} capabilityError={capabilityError} capabilityScannedKeys={capabilityScannedKeys} selectedKeys={selectedApplicationKeys} setSelectedKeys={setSelectedApplicationKeys} onRefresh={refreshAppCapabilities} onCancel={() => window.materialTools.cancelAppCapabilities()} operationAction={applicationOperationAction} setOperationAction={setApplicationOperationAction} operationPreview={applicationOperationPreview} operationProgress={applicationOperationProgress} operationResult={applicationOperationResult} operationState={applicationOperationState} operationError={applicationOperationError} captureFixture={summary?.captureFixture ?? false} onPreviewOperation={previewApplicationOperation} onExecuteOperation={executeApplicationOperation} onCancelOperation={(operationId) => window.materialTools.cancelApplicationOperation(operationId)} />}
          {activeTab === 'settings' && <SettingsPage settings={settings} setSettings={setSettings} vocabulary={vocabulary} setVocabulary={updateVocabulary} notify={notify} copy={copy} />}
          {!['overview', 'install', 'settings'].includes(activeTab) && <PlannedCapabilityPage tab={current} settings={settings} copy={copy} />}
        </main>
      </div>
      <div className="toast-region" aria-live="polite" aria-label={copy('Notifications')}>
        {notifications.filter((item) => item.toastVisible).map((item) => <article className={`toast ${item.tone}`} key={item.id}><ActionIllustration id={ACTION_ILLUSTRATION_BINDINGS.surfaces.notifications} language={settings.language} copy={copy} variant="notification" loading="eager" /><div className="toast__copy"><strong>{copy(item.title)}</strong><p>{copy(item.body)}</p></div><button type="button" aria-label={copy(`Dismiss ${item.title}`)} onClick={() => markNotificationsReviewed([item.id])}>×</button></article>)}
      </div>
      <CommandPalette open={paletteOpen} onClose={closePalette} onNavigate={navigate} onOpenNotifications={() => setNotificationCenterOpen(true)} settings={settings} copy={copy} />
      <NotificationCenter open={notificationCenterOpen} notifications={notifications} settings={settings} copy={copy} onClose={closeNotificationCenter} onReview={(id) => markNotificationsReviewed([id])} onReviewVisible={markNotificationsReviewed} />
    </div>
  );
}
