import {
  ACTION_ILLUSTRATIONS,
  actionIllustrationAlt,
  type ActionIllustrationId,
  type IllustrationLanguage,
} from '../action-illustrations';

type IllustrationVariant = 'feature' | 'card' | 'dialog' | 'popover' | 'setting' | 'notification';

interface ActionIllustrationProps {
  id: ActionIllustrationId;
  language: IllustrationLanguage;
  copy: (value: string) => string;
  variant?: IllustrationVariant;
  loading?: 'eager' | 'lazy';
}

export function ActionIllustration({ id, language, copy, variant = 'feature', loading = 'lazy' }: ActionIllustrationProps) {
  const illustration = ACTION_ILLUSTRATIONS[id];
  return (
    <figure className={`action-illustration action-illustration--${variant}`} data-illustration-id={id}>
      <img
        src={illustration.src}
        alt={copy(actionIllustrationAlt(id, language))}
        loading={loading}
        decoding="async"
        draggable="false"
      />
    </figure>
  );
}
