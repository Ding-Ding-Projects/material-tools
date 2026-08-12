import { actionIllustrationBindings, type ActionIllustrationSurface } from '../action-illustrations';
import type { LanguageMode } from '../types';

export type ActionIllustrationVariant = 'hero' | 'card' | 'article' | 'page' | 'panel' | 'builder' | 'thumbnail' | 'toast';

interface ActionIllustrationProps {
  surface: ActionIllustrationSurface;
  language?: LanguageMode;
  schoolMode?: boolean;
  variant?: ActionIllustrationVariant;
  eager?: boolean;
}

export function ActionIllustration({
  surface,
  language = 'en',
  schoolMode = false,
  variant = 'card',
  eager = false,
}: ActionIllustrationProps) {
  const binding = actionIllustrationBindings[surface];
  const mode = schoolMode ? 'en' : language;
  const alt = mode === 'yue'
    ? binding.altCantonese
    : mode === 'both'
      ? `${binding.altEnglish} · ${binding.altCantonese}`
      : binding.altEnglish;

  return (
    <div className={`action-illustration action-illustration--${variant}`} data-action-surface={surface}>
      <img
        src={binding.src}
        alt={alt}
        width="768"
        height="512"
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable="false"
      />
    </div>
  );
}
