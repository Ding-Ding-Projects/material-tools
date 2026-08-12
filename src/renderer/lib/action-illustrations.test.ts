import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import appSource from '../App.tsx?raw';
import {
  ACTION_ILLUSTRATION_BINDINGS,
  ACTION_ILLUSTRATIONS,
  DOCUMENTED_ILLUSTRATION_EXCEPTIONS,
  FEATURE_PAGE_ILLUSTRATION_IDS,
  IMPLEMENTED_SURFACE_ILLUSTRATION_IDS,
  actionIllustrationAlt,
} from '../action-illustrations';
import { ActionIllustration } from '../components/ActionIllustration';
import regexBuilderSource from '../components/AnchoredRegexBuilder.tsx?raw';

const REQUIRED_FEATURE_PAGES = ['overview', 'install', 'tweaks', 'config', 'updates', 'microwin', 'settings'] as const;
const REQUIRED_IMPLEMENTED_SURFACES = [
  'command-palette',
  'regex-builder',
  'notifications',
  'private-vocabulary',
  'applications-catalog',
  'package-manager-readiness',
  'operation-plan',
  'operation-progress',
  'operation-recovery',
] as const;

describe('action illustration coverage', () => {
  it('keeps every current feature page and implemented transient surface on the hand-written inventory', () => {
    expect(FEATURE_PAGE_ILLUSTRATION_IDS).toEqual(REQUIRED_FEATURE_PAGES);
    expect(IMPLEMENTED_SURFACE_ILLUSTRATION_IDS).toEqual(REQUIRED_IMPLEMENTED_SURFACES);
    expect(new Set([...FEATURE_PAGE_ILLUSTRATION_IDS, ...IMPLEMENTED_SURFACE_ILLUSTRATION_IDS]).size).toBe(16);
  });

  it('provides a bundled WebP and meaningful bilingual alt text for every inventory entry', () => {
    for (const id of [...FEATURE_PAGE_ILLUSTRATION_IDS, ...IMPLEMENTED_SURFACE_ILLUSTRATION_IDS]) {
      const illustration = ACTION_ILLUSTRATIONS[id];
      expect(illustration.src).toMatch(/\.webp(?:\?|$)/);
      expect(illustration.alt.en.length).toBeGreaterThan(24);
      expect(illustration.alt.yue.length).toBeGreaterThan(12);
      expect(actionIllustrationAlt(id, 'both')).toBe(`${illustration.alt.en} · ${illustration.alt.yue}`);
    }
  });

  it('renders localized informative alt text with lazy loading and asynchronous decoding', () => {
    const markup = renderToStaticMarkup(createElement(ActionIllustration, {
      id: 'overview',
      language: 'both',
      copy: (value: string) => value,
    }));
    expect(markup).toContain('data-illustration-id="overview"');
    expect(markup).toContain('loading="lazy"');
    expect(markup).toContain('decoding="async"');
    expect(markup).toContain(actionIllustrationAlt('overview', 'both'));
  });

  it('binds each real renderer surface to an explicit inventory entry', () => {
    expect(ACTION_ILLUSTRATION_BINDINGS.featurePages).toEqual({
      overview: 'overview',
      install: 'install',
      tweaks: 'tweaks',
      config: 'config',
      updates: 'updates',
      microwin: 'microwin',
      settings: 'settings',
    });
    expect(ACTION_ILLUSTRATION_BINDINGS.surfaces).toEqual({
      commandPalette: 'command-palette',
      regexBuilder: 'regex-builder',
      notifications: 'notifications',
      privateVocabulary: 'private-vocabulary',
      applicationsCatalog: 'applications-catalog',
      packageManagerReadiness: 'package-manager-readiness',
      operationPlan: 'operation-plan',
      operationProgress: 'operation-progress',
      operationRecovery: 'operation-recovery',
    });

    for (const binding of [
      'ACTION_ILLUSTRATION_BINDINGS.featurePages.overview}',
      'ACTION_ILLUSTRATION_BINDINGS.featurePages.settings}',
      'tab.illustrationId}',
      'ACTION_ILLUSTRATION_BINDINGS.surfaces.commandPalette}',
      'ACTION_ILLUSTRATION_BINDINGS.surfaces.notifications}',
      'ACTION_ILLUSTRATION_BINDINGS.surfaces.privateVocabulary}',
      'ACTION_ILLUSTRATION_BINDINGS.surfaces.applicationsCatalog}',
      'ACTION_ILLUSTRATION_BINDINGS.surfaces.packageManagerReadiness}',
      'ACTION_ILLUSTRATION_BINDINGS.surfaces.operationPlan}',
      'ACTION_ILLUSTRATION_BINDINGS.surfaces.operationProgress}',
      'ACTION_ILLUSTRATION_BINDINGS.surfaces.operationRecovery}',
    ]) {
      expect(appSource).toContain(`<ActionIllustration id={${binding}`);
    }
    expect(regexBuilderSource).toContain('<ActionIllustration id={ACTION_ILLUSTRATION_BINDINGS.surfaces.regexBuilder}');
  });

  it('documents the unused destructive-confirmation art instead of inventing a fake dialog', () => {
    expect(ACTION_ILLUSTRATIONS['destructive-confirmation'].src).toMatch(/\.webp(?:\?|$)/);
    expect(DOCUMENTED_ILLUSTRATION_EXCEPTIONS['destructive-confirmation']).toContain('not implemented');
    expect(DOCUMENTED_ILLUSTRATION_EXCEPTIONS['destructive-confirmation']).toContain('not rendered');
  });

  it('opens the anchored builder at its visible header instead of scrolling to a buried field', () => {
    expect(regexBuilderSource).toContain('closeRef.current?.focus({ preventScroll: true })');
    expect(regexBuilderSource).toContain('ref={closeRef}');
    expect(regexBuilderSource).not.toContain('patternRef.current?.focus(');
  });
});
