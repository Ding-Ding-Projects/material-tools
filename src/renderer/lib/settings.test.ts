import { describe, expect, it } from 'vitest';
import { applySetting, type FoundationSettings } from './settings';

const baseline: FoundationSettings = {
  displayName: 'Material Tools',
  language: 'en',
  englishFunny: 2,
  cantoneseFunny: 3,
  showDialogEmoji: true,
  theme: 'dark',
  density: 'comfortable',
  accent: '#9dccff',
};

describe('settings updates', () => {
  it('preserves one rapid update while applying the next', () => {
    const light = applySetting(baseline, 'theme', 'light');
    const bilingual = applySetting(light, 'language', 'both');
    expect(bilingual).toMatchObject({ theme: 'light', language: 'both' });
  });
});
