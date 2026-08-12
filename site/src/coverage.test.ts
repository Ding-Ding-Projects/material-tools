import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import App from './App';
import { articles } from './catalog';
import {
  coverageInventory,
  requiredCoverageIds,
  requiredNonRenderedCoverageIds,
  requiredRenderedCoverageIds,
} from './coverage';

function missingStaticSurfaceAnchors(root: ParentNode): string[] {
  const anchors = [
    ['m3-shell', '.app-shell'],
    ['tab-docking', 'nav[aria-label="Feature tabs"] [role="tablist"]'],
    ['tab-state', '#tab-applications[role="tab"]'],
    ['command-palette', 'button.command-palette-trigger'],
    ['action-illustrations', '[data-action-surface="feature-overview"] img'],
  ] as const;
  return anchors.filter(([, selector]) => !root.querySelector(selector)).map(([id]) => id);
}

describe('hand-written coverage inventory', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it('contains every required core contract exactly once', () => {
    expect(new Set(requiredCoverageIds).size).toBe(requiredCoverageIds.length);
    expect(coverageInventory.map((item) => item.id).sort()).toEqual([...requiredCoverageIds].sort());
    expect(coverageInventory.every((item) => item.evidence.trim().length > 0)).toBe(true);
    const claimedIds = coverageInventory.filter((item) => item.status !== 'planned').map((item) => item.id).sort();
    expect([...requiredRenderedCoverageIds, ...requiredNonRenderedCoverageIds].sort()).toEqual(claimedIds);
  });

  it('renders and operates every claimed user-facing surface', () => {
    const proved = new Set<string>();
    const prove = (id: (typeof requiredRenderedCoverageIds)[number], condition: unknown) => {
      expect(condition, `${id} has no rendered proof`).toBeTruthy();
      proved.add(id);
    };

    const { container } = render(createElement(App));
    prove('m3-shell', container.querySelector('.app-shell'));
    prove('tab-docking', screen.getByRole('tablist').getAttribute('aria-orientation') === 'vertical');
    prove('action-illustrations', container.querySelector('[data-action-surface="feature-overview"] img'));

    fireEvent.contextMenu(screen.getByRole('tab', { name: 'Applications' }));
    const tabMenu = screen.getByRole('dialog', { name: 'Applications tab' });
    prove('tab-state', within(tabMenu).getByRole('menuitem', { name: /Pin tab/ }));
    prove('filtered-menus', within(tabMenu).getByLabelText('Applications tab actions'));
    fireEvent.click(within(tabMenu).getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('button', { name: 'Tab discovery' }));
    const discoveryProofs = [
      ['tab-search-current', 'Current tab strip'],
      ['tab-search-group', 'Current tab group'],
      ['tab-search-groups', 'Tab groups by name'],
      ['tab-search-master', 'Master tab search'],
    ] as const;
    for (const [id, label] of discoveryProofs) {
      prove(id, screen.getByLabelText(label));
      expect(screen.getByRole('button', { name: `Open anchored regex builder for ${label}` })).toBeInTheDocument();
    }
    fireEvent.click(within(screen.getByLabelText('Tab discovery')).getByRole('button', { name: 'Close' }));

    fireEvent.keyDown(window, { key: 'F', ctrlKey: true, shiftKey: true });
    const palette = screen.getByRole('dialog', { name: 'Command palette' });
    prove('command-palette', within(palette).getByLabelText('Commands and destinations'));
    expect(palette.querySelector('[data-action-surface="dialog-command-palette"] img')).toBeInTheDocument();
    fireEvent.click(within(palette).getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('tab', { name: 'Applications' }));
    const article = screen.getByRole('tabpanel', { name: 'Applications' });
    prove('feature-docs', within(article).getByRole('heading', { name: 'Applications' }));
    expect(article.querySelector('[data-action-surface="feature-applications"] img')).toBeInTheDocument();
    fireEvent.click(within(article).getByRole('button', { name: 'Edit appearance…' }));
    const appearanceEditor = screen.getByRole('dialog', { name: 'Appearance editor for card:applications' });
    prove('appearance', within(appearanceEditor).getByLabelText('Appearance editor settings'));
    fireEvent.click(within(appearanceEditor).getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('tab', { name: /Settings Pinned/ }));
    prove('languages', screen.getByRole('group', { name: 'Language mode' }));
    prove('funny-levels', screen.getByRole('slider', { name: 'English funny level' }) && screen.getByRole('slider', { name: 'Cantonese funny level' }));
    prove('emoji-toggle', screen.getByRole('checkbox', { name: 'Show emoji decorations in dialogs and messages' }));
    prove('school-shell', screen.getByRole('checkbox', { name: 'Enable School mode' }));
    prove('private-vocabulary', screen.getByLabelText('Private vocabulary JSON file'));
    const dock = screen.getByRole('group', { name: 'Dock edge' });
    expect(within(dock).getAllByRole('button').map((button) => button.textContent)).toEqual(['Left', 'Right', 'Top', 'Bottom']);

    fireEvent.click(screen.getByRole('tab', { name: 'Notifications' }));
    const createNotification = screen.getByRole('button', { name: 'Create sample notification' });
    fireEvent.click(createNotification);
    prove('notifications', screen.getByRole('heading', { name: 'Sample notification' }));

    expect([...proved].sort()).toEqual([...requiredRenderedCoverageIds].sort());
  });

  it('reports a missing required anchor instead of trusting its inventory row', () => {
    const { container } = render(createElement(App));
    expect(missingStaticSurfaceAnchors(container)).toEqual([]);
    container.querySelector('button.command-palette-trigger')?.remove();
    expect(missingStaticSurfaceAnchors(container)).toEqual(['command-palette']);
  });

  it('covers every upstream feature category with a cited article', () => {
    expect(articles.map((article) => article.id).sort()).toEqual(
      ['applications', 'automation', 'config', 'creator', 'tweaks', 'updates'],
    );
    for (const article of articles) {
      expect(article.sourcePath).toMatch(/^docs\/src\/content\/docs\/guides\//);
      expect(article.sourceUrl).toContain('ea5de27b6c66fe4f4a4c6513887d0fe5a1cd8bff');
      expect(article.capabilities.length).toBeGreaterThan(2);
    }
  });
});
