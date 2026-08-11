export type LanguageMode = 'en' | 'yue' | 'both';
export type DockEdge = 'left' | 'right' | 'top' | 'bottom';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface SearchState {
  query: string;
  regex: boolean;
  flags: string;
}

export interface TabRecord {
  id: string;
  label: string;
  labelYue: string;
  groupId: string;
  pinned: boolean;
  order: number;
  icon: string;
}

export interface TabGroup {
  id: string;
  name: string;
  nameYue: string;
  color: string;
  collapsed: boolean;
  order: number;
}

export interface ElementAppearance {
  accent: string;
  radius: number;
  emphasis: 'regular' | 'strong';
}

export interface NotificationRecord {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  kind: 'info' | 'success' | 'warning';
  dismissed: boolean;
}

export interface Preferences {
  language: LanguageMode;
  funnyEnglish: number;
  funnyCantonese: number;
  showEmoji: boolean;
  schoolMode: boolean;
  schoolModeName: string;
  dock: DockEdge;
  theme: ThemeMode;
  accent: string;
  density: 'comfortable' | 'compact';
  fontScale: number;
  paletteSize: 'card' | 'full';
}

export interface PersistedState {
  version: 1;
  preferences: Preferences;
  tabs: TabRecord[];
  groups: TabGroup[];
  notifications: NotificationRecord[];
  appearance: Record<string, ElementAppearance>;
}

export interface FeatureArticle {
  id: string;
  title: string;
  titleYue: string;
  eyebrow: string;
  summary: string;
  summaryYue: string;
  capabilities: string[];
  notes: string[];
  sourcePath: string;
  sourceUrl: string;
}
