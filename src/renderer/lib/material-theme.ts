import {
  argbFromHex,
  hexFromArgb,
  themeFromSourceColor,
} from '@material/material-color-utilities';

const DEFAULT_SEED = '#6750a4';

function kebabCase(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

export function normalizeSeed(value: string): string {
  const trimmed = value.trim();
  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed.toLowerCase() : DEFAULT_SEED;
}

export function materialThemeTokens(seed: string, dark: boolean): Record<string, string> {
  const theme = themeFromSourceColor(argbFromHex(normalizeSeed(seed)));
  const scheme = dark ? theme.schemes.dark : theme.schemes.light;
  const tokens = Object.fromEntries(
    Object.entries(scheme.toJSON()).map(([name, value]) => [kebabCase(name), hexFromArgb(value)]),
  );
  const neutralTones = dark
    ? {
        'surface-dim': 6,
        'surface-bright': 24,
        'surface-container-lowest': 4,
        'surface-container-low': 10,
        'surface-container': 12,
        'surface-container-high': 17,
        'surface-container-highest': 22,
      }
    : {
        'surface-dim': 87,
        'surface-bright': 98,
        'surface-container-lowest': 100,
        'surface-container-low': 96,
        'surface-container': 94,
        'surface-container-high': 92,
        'surface-container-highest': 90,
      };
  for (const [name, tone] of Object.entries(neutralTones)) {
    tokens[name] = hexFromArgb(theme.palettes.neutral.tone(tone));
  }
  return tokens;
}

export function materialThemeCssVariables(seed: string, dark: boolean): Record<`--${string}`, string> {
  return Object.fromEntries(
    Object.entries(materialThemeTokens(seed, dark)).map(([name, value]) => [`--${name}`, value]),
  ) as Record<`--${string}`, string>;
}
