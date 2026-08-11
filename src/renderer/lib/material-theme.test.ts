import { describe, expect, it } from 'vitest';
import { materialThemeCssVariables, materialThemeTokens, normalizeSeed } from './material-theme';

function channelToLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  return 0.2126 * channelToLinear(channels[0])
    + 0.7152 * channelToLinear(channels[1])
    + 0.0722 * channelToLinear(channels[2]);
}

function contrast(first: string, second: string): number {
  const values = [luminance(first), luminance(second)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe('Material 3 theme roles', () => {
  it('normalizes valid seeds and falls back from malformed input', () => {
    expect(normalizeSeed(' #ABCDEF ')).toBe('#abcdef');
    expect(normalizeSeed('not-a-color')).toBe('#6750a4');
  });

  it.each([false, true])('derives contrast-safe roles for extreme seeds when dark=%s', (dark) => {
    for (const seed of ['#6750a4', '#ffffff', '#000000', '#ff0000']) {
      const tokens = materialThemeTokens(seed, dark);
      expect(contrast(tokens.primary, tokens['on-primary'])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens.surface, tokens['on-surface'])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens['primary-container'], tokens['on-primary-container'])).toBeGreaterThanOrEqual(4.5);
      expect(tokens['surface-container-lowest']).toMatch(/^#[0-9a-f]{6}$/);
      expect(tokens['surface-container-highest']).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('exposes CSS custom properties for every generated role', () => {
    const variables = materialThemeCssVariables('#00ff00', false);
    expect(variables['--primary']).toMatch(/^#[0-9a-f]{6}$/);
    expect(variables['--on-primary']).toMatch(/^#[0-9a-f]{6}$/);
    expect(variables['--surface-container-highest']).toMatch(/^#[0-9a-f]{6}$/);
  });
});
