import { describe, expect, it } from 'vitest';
import { APPLICATION_CATALOG } from '../../shared/application-catalog.generated';
import type { ApplicationInstalledState } from '../../shared/contracts';
import {
  catalogCategories,
  filterApplicationCatalog,
  MAX_APPLICATION_PLAN_ITEMS,
  mergeCatalogSelection,
  type CatalogFilterState,
} from './application-catalog-workspace';

const DEFAULT_FILTERS: CatalogFilterState = {
  query: '',
  options: { regex: false, caseSensitive: false, multiline: false },
  category: 'all',
  source: 'all',
  status: 'all',
};

describe('application catalog workspace', () => {
  it('keeps the complete pinned inventory reachable and derives real category choices', () => {
    const result = filterApplicationCatalog(APPLICATION_CATALOG, DEFAULT_FILTERS, new Set(), new Map());
    expect(result.matches).toHaveLength(227);
    expect(result.error).toBeNull();
    expect(catalogCategories(APPLICATION_CATALOG).length).toBeGreaterThan(8);
  });

  it('composes regex, category, and source filters without inventing catalog entries', () => {
    const result = filterApplicationCatalog(APPLICATION_CATALOG, {
      ...DEFAULT_FILTERS,
      query: '^VLC',
      options: { regex: true, caseSensitive: false, multiline: false },
      category: 'Multimedia Tools',
      source: 'winget',
    }, new Set(), new Map());

    expect(result.error).toBeNull();
    expect(result.matches.map((item) => item.key)).toEqual(['vlc']);
  });

  it('distinguishes selected, detected, and not-yet-detected application states', () => {
    const item = APPLICATION_CATALOG.find((candidate) => candidate.key === 'firefox');
    expect(item).toBeDefined();
    const detected = new Map<string, ApplicationInstalledState>([[
      'firefox',
      { id: 'firefox', name: 'Firefox', category: item!.category, status: 'installed', manager: 'winget', version: '1.0' },
    ]]);

    const installed = filterApplicationCatalog(APPLICATION_CATALOG, { ...DEFAULT_FILTERS, status: 'installed' }, new Set(), detected);
    const selected = filterApplicationCatalog(APPLICATION_CATALOG, { ...DEFAULT_FILTERS, status: 'selected' }, new Set(['firefox']), detected);
    const unknown = filterApplicationCatalog(APPLICATION_CATALOG, { ...DEFAULT_FILTERS, status: 'unknown' }, new Set(), detected);

    expect(installed.matches.map((candidate) => candidate.key)).toEqual(['firefox']);
    expect(selected.matches.map((candidate) => candidate.key)).toEqual(['firefox']);
    expect(unknown.matches).toHaveLength(226);
  });

  it('reports invalid regex feedback and merges all current matches without duplicates', () => {
    const invalid = filterApplicationCatalog(APPLICATION_CATALOG, {
      ...DEFAULT_FILTERS,
      query: '(',
      options: { regex: true, caseSensitive: false, multiline: false },
    }, new Set(), new Map());
    expect(invalid.matches).toHaveLength(0);
    expect(invalid.error).toBeTruthy();

    const merged = mergeCatalogSelection(['firefox'], APPLICATION_CATALOG.filter((item) => ['firefox', 'vlc'].includes(item.key)));
    expect(merged).toEqual(['firefox', 'vlc']);

    const capped = mergeCatalogSelection([], APPLICATION_CATALOG);
    expect(capped).toHaveLength(MAX_APPLICATION_PLAN_ITEMS);
    expect(new Set(capped).size).toBe(MAX_APPLICATION_PLAN_ITEMS);
  });
});
