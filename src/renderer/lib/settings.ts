export interface FoundationSettings {
  displayName: string;
  language: 'en' | 'yue' | 'both';
  englishFunny: number;
  cantoneseFunny: number;
  showDialogEmoji: boolean;
  theme: 'light' | 'dark';
  density: 'comfortable' | 'compact';
  accent: string;
}

export function applySetting<K extends keyof FoundationSettings>(
  current: FoundationSettings,
  key: K,
  value: FoundationSettings[K],
): FoundationSettings {
  return { ...current, [key]: value };
}
