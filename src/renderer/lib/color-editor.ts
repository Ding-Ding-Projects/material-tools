export interface HslColor {
  hue: number;
  saturation: number;
  lightness: number;
}

export function normalizeEditableHex(value: string): string | null {
  const trimmed = value.trim();
  return /^#[0-9a-f]{6}$/iu.test(trimmed) ? trimmed.toLowerCase() : null;
}

export function hexToHsl(hex: string): HslColor {
  const normalized = normalizeEditableHex(hex) ?? '#000000';
  const [red, green, blue] = [1, 3, 5].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16) / 255);
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;
  if (delta !== 0) {
    if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  if (hue < 0) hue += 360;
  const lightness = (maximum + minimum) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return {
    hue: Math.round(hue),
    saturation: Math.round(saturation * 100),
    lightness: Math.round(lightness * 100),
  };
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
