import { describe, expect, it } from 'vitest';
import { hexToHsl, hslToHex, normalizeEditableHex } from './color-editor';

describe('Material accent color editor', () => {
  it('normalizes only complete six-digit HEX values', () => {
    expect(normalizeEditableHex(' #6750A4 ')).toBe('#6750a4');
    expect(normalizeEditableHex('#fff')).toBeNull();
    expect(normalizeEditableHex('6750a4')).toBeNull();
  });

  it('converts continuous HSL values to HEX and back', () => {
    expect(hexToHsl('#ff0000')).toEqual({ hue: 0, saturation: 100, lightness: 50 });
    expect(hexToHsl('#00ff00')).toEqual({ hue: 120, saturation: 100, lightness: 50 });
    expect(hslToHex({ hue: 240, saturation: 100, lightness: 50 })).toBe('#0000ff');
    const rounded = hslToHex(hexToHsl('#6750a4'));
    const channels = (hex: string) => [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
    expect(channels(rounded).every((channel, index) => Math.abs(channel - channels('#6750a4')[index]) <= 1)).toBe(true);
  });
});
