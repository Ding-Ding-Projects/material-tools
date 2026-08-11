import { describe, expect, it } from 'vitest';
import { bestContrastingText, contrastRatio, hexToHsl, hslToHex, materialThemeTokens, normalizeHex } from './color';

describe('appearance color helpers', () => {
  it('normalizes bounded six-digit hex colors', () => {
    expect(normalizeHex(' #ABCDEF ')).toBe('#abcdef');
    expect(normalizeHex('transparent')).toBeNull();
  });

  it('chooses readable primary text at both contrast extremes', () => {
    expect(bestContrastingText('#ffffff')).toBe('#000000');
    expect(bestContrastingText('#000000')).toBe('#ffffff');
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21);
  });

  it('round-trips the default accent through HSL', () => {
    const roundTrip = hslToHex(hexToHsl('#6750a4'));
    const channels = (hex: string) => [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
    expect(channels(roundTrip).map((channel, index) => Math.abs(channel - channels('#6750a4')[index]))).toEqual([0, 1, 0]);
  });

  it.each([false, true])('derives contrast-safe M3 roles from the seed when dark=%s', (dark) => {
    for (const seed of ['#6750a4', '#ffffff', '#000000', '#ff0000']) {
      const tokens = materialThemeTokens(seed, dark);
      expect(contrastRatio(tokens.primary, tokens['on-primary'])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens.surface, tokens['on-surface'])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens['primary-container'], tokens['on-primary-container'])).toBeGreaterThanOrEqual(4.5);
      expect(tokens['surface-container-lowest']).toMatch(/^#[0-9a-f]{6}$/);
      expect(tokens['surface-container-highest']).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
