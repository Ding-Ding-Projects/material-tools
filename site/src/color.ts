import {
  argbFromHex,
  hexFromArgb,
  themeFromSourceColor,
} from '@material/material-color-utilities';

export interface HslColor {
  hue: number;
  saturation: number;
  lightness: number;
}

function kebabCase(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

export function materialThemeTokens(seed: string, dark: boolean): Record<string, string> {
  const source = normalizeHex(seed) ?? '#6750a4';
  const theme = themeFromSourceColor(argbFromHex(source));
  const scheme = dark ? theme.schemes.dark : theme.schemes.light;
  const tokens = Object.fromEntries(
    Object.entries(scheme.toJSON()).map(([name, value]) => [kebabCase(name), hexFromArgb(value)]),
  );
  const neutralTones = dark
    ? { 'surface-dim': 6, 'surface-bright': 24, 'surface-container-lowest': 4, 'surface-container-low': 10, 'surface-container': 12, 'surface-container-high': 17, 'surface-container-highest': 22 }
    : { 'surface-dim': 87, 'surface-bright': 98, 'surface-container-lowest': 100, 'surface-container-low': 96, 'surface-container': 94, 'surface-container-high': 92, 'surface-container-highest': 90 };
  for (const [name, tone] of Object.entries(neutralTones)) {
    tokens[name] = hexFromArgb(theme.palettes.neutral.tone(tone));
  }
  return tokens;
}

export function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed.toLowerCase() : null;
}

function channelToLinear(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const normalized = normalizeHex(hex) ?? '#000000';
  const channels = [1, 3, 5].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16));
  return 0.2126 * channelToLinear(channels[0])
    + 0.7152 * channelToLinear(channels[1])
    + 0.0722 * channelToLinear(channels[2]);
}

export function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function bestContrastingText(background: string): '#000000' | '#ffffff' {
  return contrastRatio(background, '#000000') >= contrastRatio(background, '#ffffff') ? '#000000' : '#ffffff';
}

export function hexToHsl(hex: string): HslColor {
  const normalized = normalizeHex(hex) ?? '#000000';
  const [red, green, blue] = [1, 3, 5].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16) / 255);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  if (hue < 0) hue += 360;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return { hue: Math.round(hue), saturation: Math.round(saturation * 100), lightness: Math.round(lightness * 100) };
}

export function hslToHex({ hue, saturation, lightness }: HslColor): string {
  const safeHue = ((hue % 360) + 360) % 360;
  const safeSaturation = Math.min(100, Math.max(0, saturation)) / 100;
  const safeLightness = Math.min(100, Math.max(0, lightness)) / 100;
  const chroma = (1 - Math.abs(2 * safeLightness - 1)) * safeSaturation;
  const component = chroma * (1 - Math.abs((safeHue / 60) % 2 - 1));
  const offset = safeLightness - chroma / 2;
  const sectors = safeHue < 60 ? [chroma, component, 0]
    : safeHue < 120 ? [component, chroma, 0]
      : safeHue < 180 ? [0, chroma, component]
        : safeHue < 240 ? [0, component, chroma]
          : safeHue < 300 ? [component, 0, chroma]
            : [chroma, 0, component];
  return `#${sectors.map((channel) => Math.round((channel + offset) * 255).toString(16).padStart(2, '0')).join('')}`;
}
