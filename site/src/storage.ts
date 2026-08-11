import type { ElementAppearance, NotificationRecord, PersistedState, Preferences, TabGroup, TabRecord } from './types';

export const STORAGE_KEY = 'material-tools.pages.state.v1';

const MAX_TABS = 100;
const MAX_GROUPS = 40;
const MAX_NOTIFICATIONS = 200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBoundedString(value: unknown, max = 120): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function normalizePreferences(value: unknown, fallback: Preferences): Preferences {
  if (!isRecord(value)) return { ...fallback };
  return {
    language: value.language === 'en' || value.language === 'yue' || value.language === 'both' ? value.language : fallback.language,
    funnyEnglish: isFiniteNumber(value.funnyEnglish) && value.funnyEnglish >= 1 && value.funnyEnglish <= 5 ? value.funnyEnglish : fallback.funnyEnglish,
    funnyCantonese: isFiniteNumber(value.funnyCantonese) && value.funnyCantonese >= 1 && value.funnyCantonese <= 5 ? value.funnyCantonese : fallback.funnyCantonese,
    showEmoji: typeof value.showEmoji === 'boolean' ? value.showEmoji : fallback.showEmoji,
    schoolMode: typeof value.schoolMode === 'boolean' ? value.schoolMode : fallback.schoolMode,
    schoolModeName: isBoundedString(value.schoolModeName, 48) ? value.schoolModeName : fallback.schoolModeName,
    dock: value.dock === 'left' || value.dock === 'right' || value.dock === 'top' || value.dock === 'bottom' ? value.dock : fallback.dock,
    theme: value.theme === 'light' || value.theme === 'dark' || value.theme === 'system' ? value.theme : fallback.theme,
    accent: typeof value.accent === 'string' && /^#[0-9a-f]{6}$/i.test(value.accent) ? value.accent : fallback.accent,
    density: value.density === 'comfortable' || value.density === 'compact' ? value.density : fallback.density,
    fontScale: isFiniteNumber(value.fontScale) && value.fontScale >= 0.9 && value.fontScale <= 1.3 ? value.fontScale : fallback.fontScale,
    paletteSize: value.paletteSize === 'card' || value.paletteSize === 'full' ? value.paletteSize : fallback.paletteSize,
  };
}

function normalizeGroups(value: unknown, fallback: TabGroup[]): TabGroup[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_GROUPS) return fallback.map((group) => ({ ...group }));
  const groups: TabGroup[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)
      || !isBoundedString(item.id, 64)
      || ids.has(item.id)
      || !isBoundedString(item.name)
      || !isBoundedString(item.nameYue)
      || typeof item.color !== 'string'
      || !/^#[0-9a-f]{6}$/i.test(item.color)
      || typeof item.collapsed !== 'boolean'
      || !isFiniteNumber(item.order)) {
      return fallback.map((group) => ({ ...group }));
    }
    ids.add(item.id);
    groups.push({ id: item.id, name: item.name, nameYue: item.nameYue, color: item.color, collapsed: item.collapsed, order: item.order });
  }
  return groups;
}

function normalizeTabs(value: unknown, groups: TabGroup[], fallback: TabRecord[]): TabRecord[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_TABS) return fallback.map((tab) => ({ ...tab }));
  const groupIds = new Set(groups.map((group) => group.id));
  const ids = new Set<string>();
  const tabs: TabRecord[] = [];
  for (const item of value) {
    if (!isRecord(item)
      || !isBoundedString(item.id, 64)
      || ids.has(item.id)
      || !isBoundedString(item.label)
      || !isBoundedString(item.labelYue)
      || typeof item.groupId !== 'string'
      || !groupIds.has(item.groupId)
      || typeof item.pinned !== 'boolean'
      || !isFiniteNumber(item.order)
      || !isBoundedString(item.icon, 8)) {
      return fallback.map((tab) => ({ ...tab }));
    }
    ids.add(item.id);
    tabs.push({
      id: item.id,
      label: item.label,
      labelYue: item.labelYue,
      groupId: item.groupId,
      pinned: item.pinned,
      order: item.order,
      icon: item.icon,
    });
  }
  if (!tabs.some((tab) => tab.pinned)) tabs[0] = { ...tabs[0], pinned: true };
  return tabs;
}

function normalizeNotifications(value: unknown, fallback: NotificationRecord[]): NotificationRecord[] {
  if (!Array.isArray(value) || value.length > MAX_NOTIFICATIONS) return fallback.map((item) => ({ ...item }));
  const notifications: NotificationRecord[] = [];
  for (const item of value) {
    if (!isRecord(item)
      || !isBoundedString(item.id)
      || !isBoundedString(item.title, 160)
      || !isBoundedString(item.body, 600)
      || !isBoundedString(item.createdAt, 48)
      || (item.kind !== 'info' && item.kind !== 'success' && item.kind !== 'warning')
      || typeof item.dismissed !== 'boolean') {
      return fallback.map((entry) => ({ ...entry }));
    }
    notifications.push({
      id: item.id,
      title: item.title,
      body: item.body,
      createdAt: item.createdAt,
      kind: item.kind,
      dismissed: item.dismissed,
    });
  }
  return notifications;
}

function normalizeAppearance(value: unknown): Record<string, ElementAppearance> {
  if (!isRecord(value) || Object.keys(value).length > 200) return {};
  const appearance: Record<string, ElementAppearance> = {};
  for (const [target, item] of Object.entries(value)) {
    if (!isBoundedString(target, 120)
      || !isRecord(item)
      || typeof item.accent !== 'string'
      || !/^#[0-9a-f]{6}$/i.test(item.accent)
      || !isFiniteNumber(item.radius)
      || item.radius < 0
      || item.radius > 32
      || (item.emphasis !== 'regular' && item.emphasis !== 'strong')) continue;
    appearance[target] = { accent: item.accent, radius: item.radius, emphasis: item.emphasis };
  }
  return appearance;
}

export function loadState(fallback: PersistedState): PersistedState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1) return fallback;
    let groups = normalizeGroups(parsed.groups, fallback.groups);
    let tabs = normalizeTabs(parsed.tabs, groups, fallback.tabs);
    const groupIds = new Set(groups.map((group) => group.id));
    if (tabs.some((tab) => !groupIds.has(tab.groupId))) {
      groups = fallback.groups.map((group) => ({ ...group }));
      tabs = fallback.tabs.map((tab) => ({ ...tab }));
    }
    return {
      version: 1,
      preferences: normalizePreferences(parsed.preferences, fallback.preferences),
      tabs,
      groups,
      notifications: normalizeNotifications(parsed.notifications, fallback.notifications),
      appearance: normalizeAppearance(parsed.appearance),
    };
  } catch {
    return fallback;
  }
}

export function saveState(state: PersistedState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
