import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';
import { articles } from './catalog';
import {
  actionIllustrationBindings,
  articleIllustrationSurfaces,
  illustrationSurfaceForArticle,
  requiredFeatureIllustrationSurfaces,
  requiredOverlayIllustrationSurfaces,
} from './action-illustrations';
import { ActionIllustration } from './components/ActionIllustration';

const expectedFeatureSurfaces = [
  'feature-overview',
  'feature-applications',
  'feature-tweaks',
  'feature-config',
  'feature-updates',
  'feature-automation',
  'feature-creator',
  'feature-settings',
  'feature-notifications',
  'feature-private-vocabulary',
] as const;

const expectedOverlaySurfaces = [
  'sheet-mobile-navigation',
  'panel-tab-discovery',
  'dialog-tab-context',
  'dialog-group-picker',
  'dialog-appearance-editor',
  'dialog-command-palette',
  'popover-regex-builder',
  'sheet-private-vocabulary',
  'notification-toast',
] as const;

function setNarrowLayout(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

describe('hand-written action illustration completeness inventory', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setNarrowLayout(false);
  });

  it('binds every required feature and overlay surface exactly once to a local WebP', () => {
    expect(requiredFeatureIllustrationSurfaces).toEqual(expectedFeatureSurfaces);
    expect(requiredOverlayIllustrationSurfaces).toEqual(expectedOverlaySurfaces);
    expect(Object.keys(actionIllustrationBindings).sort()).toEqual(
      [...expectedFeatureSurfaces, ...expectedOverlaySurfaces].sort(),
    );

    for (const binding of Object.values(actionIllustrationBindings)) {
      const resolved = new URL(binding.src);
      expect(binding.src).toContain('.webp');
      expect(resolved.origin).toBe(window.location.origin);
      expect(resolved.pathname).toMatch(/^\/src\/assets\/action-illustrations\/[a-z-]+\.webp$/);
      expect(binding.altEnglish.trim()).not.toBe('');
      expect(binding.altCantonese.trim()).not.toBe('');
    }
  });

  it('keeps every article id in the hand-written feature binding map', () => {
    expect(Object.keys(articleIllustrationSurfaces).sort()).toEqual(articles.map((article) => article.id).sort());
    for (const article of articles) {
      expect(illustrationSurfaceForArticle(article.id)).toBe(articleIllustrationSurfaces[article.id as keyof typeof articleIllustrationSurfaces]);
    }
  });

  it('renders an action image on every feature destination and catalog card', () => {
    const { container } = render(<App />);
    expect(container.querySelector('[data-action-surface="feature-overview"]')).toBeInTheDocument();
    for (const article of articles) {
      const surface = illustrationSurfaceForArticle(article.id);
      expect(container.querySelector(`[data-action-surface="${surface}"]`)).toBeInTheDocument();
    }
    for (const article of articles) {
      const surface = illustrationSurfaceForArticle(article.id);
      fireEvent.click(screen.getByRole('tab', { name: article.title }));
      expect(container.querySelector(`[data-action-surface="${surface}"]`)).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole('tab', { name: /Settings Pinned/ }));
    expect(container.querySelector('[data-action-surface="feature-settings"]')).toBeInTheDocument();
    expect(container.querySelector('[data-action-surface="feature-private-vocabulary"]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Notifications' }));
    expect(container.querySelectorAll('[data-action-surface="feature-notifications"]').length).toBeGreaterThanOrEqual(2);
  });

  it('renders images in every implemented dialog, popover, sheet, and notification', () => {
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Tab discovery' }));
    const discovery = screen.getByLabelText('Tab discovery');
    expect(within(discovery).getByRole('img', { name: /searching across tabs/i })).toBeInTheDocument();
    fireEvent.click(within(discovery).getByRole('button', { name: 'Close' }));

    const applications = screen.getByRole('tab', { name: 'Applications' });
    fireEvent.contextMenu(applications);
    const tabMenu = screen.getByRole('dialog', { name: 'Applications tab' });
    expect(within(tabMenu).getByRole('img', { name: /organizing and personalizing/i })).toBeInTheDocument();
    fireEvent.click(within(tabMenu).getByRole('menuitem', { name: /Move… into group…/ }));
    const groupPicker = screen.getByRole('dialog', { name: 'Move into group' });
    expect(within(groupPicker).getByRole('img', { name: /destination group/i })).toBeInTheDocument();
    fireEvent.click(within(groupPicker).getByRole('button', { name: 'Close' }));

    fireEvent.contextMenu(applications);
    fireEvent.click(screen.getByRole('menuitem', { name: /Edit tab appearance…/ }));
    const appearance = screen.getByRole('dialog', { name: 'Appearance editor for tab:applications' });
    expect(within(appearance).getByRole('img', { name: /editing an element color/i })).toBeInTheDocument();
    fireEvent.click(within(appearance).getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('button', { name: /Command palette/ }));
    const palette = screen.getByRole('dialog', { name: 'Command palette' });
    expect(within(palette).getByRole('img', { name: /searching commands/i })).toBeInTheDocument();
    fireEvent.click(within(palette).getByRole('button', { name: 'Open anchored regex builder for Commands and destinations' }));
    const regex = screen.getByRole('dialog', { name: 'Regex builder for Commands and destinations' });
    expect(within(regex).getByRole('img', { name: /building a regular expression/i })).toBeInTheDocument();
    fireEvent.click(within(regex).getByRole('button', { name: 'Close' }));
    fireEvent.click(within(palette).getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('button', { name: 'Private vocabulary: Original wording' }));
    const vocabulary = screen.getByRole('dialog', { name: 'Private vocabulary' });
    expect(within(vocabulary).getByRole('img', { name: /choosing and validating/i })).toBeInTheDocument();
    fireEvent.click(within(vocabulary).getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('tab', { name: 'Notifications' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create sample notification' }));
    expect(container.querySelector('[data-action-surface="notification-toast"]')).toBeInTheDocument();
  });

  it('renders an image inside the narrow mobile navigation sheet', () => {
    setNarrowLayout(true);
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(container.querySelector('[data-action-surface="sheet-mobile-navigation"]')).toBeInTheDocument();
  });

  it('localizes image alternatives and lets School mode force English', () => {
    const { rerender } = render(<ActionIllustration surface="feature-settings" language="yue" />);
    expect(screen.getByRole('img')).toHaveAccessibleName('自訂網站主題、版面、語言同密度嘅插圖。');
    rerender(<ActionIllustration surface="feature-settings" language="both" />);
    expect(screen.getByRole('img')).toHaveAccessibleName(/personalizing the site theme.*自訂網站主題/i);
    rerender(<ActionIllustration surface="feature-settings" language="yue" schoolMode />);
    expect(screen.getByRole('img')).toHaveAccessibleName('Illustration of personalizing the site theme, layout, language, and density.');
  });
});
