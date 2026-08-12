import type { ApplicationCatalogItem } from '../../shared/application-catalog.generated';
import { MAX_APPLICATION_OPERATION_KEYS, type ApplicationInstalledState } from '../../shared/contracts';
import { evaluateSearch, type SearchOptions } from './search';

export type CatalogSourceFilter = 'all' | 'winget' | 'chocolatey' | 'foss';
export type CatalogStatusFilter = 'all' | 'selected' | 'installed' | 'not-installed' | 'unknown';

export interface CatalogFilterState {
  query: string;
  options: SearchOptions;
  category: string;
  source: CatalogSourceFilter;
  status: CatalogStatusFilter;
}

export interface CatalogFilterResult {
  matches: readonly ApplicationCatalogItem[];
  error: string | null;
}

export const MAX_APPLICATION_PLAN_ITEMS = MAX_APPLICATION_OPERATION_KEYS;

export function catalogSearchText(item: ApplicationCatalogItem): string {
  return [item.name, item.description, item.category, item.key, item.link, ...item.winget, ...item.choco].join(' ');
}

export function catalogCategories(items: readonly ApplicationCatalogItem[]): string[] {
  return Array.from(new Set(items.map((item) => item.category || 'Uncategorized')))
    .sort((left, right) => left.localeCompare(right));
}

export function filterApplicationCatalog(
  items: readonly ApplicationCatalogItem[],
  filters: CatalogFilterState,
  selectedKeys: ReadonlySet<string>,
  detectedApplications: ReadonlyMap<string, ApplicationInstalledState>,
): CatalogFilterResult {
  let error: string | null = null;
  const matches = items.filter((item) => {
    const search = evaluateSearch(filters.query, catalogSearchText(item), filters.options);
    error ??= search.error;
    if (!search.matched) return false;
    if (filters.category !== 'all' && (item.category || 'Uncategorized') !== filters.category) return false;
    if (filters.source === 'winget' && item.winget.length === 0) return false;
    if (filters.source === 'chocolatey' && item.choco.length === 0) return false;
    if (filters.source === 'foss' && !item.foss) return false;

    const detectedStatus = detectedApplications.get(item.key)?.status ?? 'unknown';
    if (filters.status === 'selected') return selectedKeys.has(item.key);
    return filters.status === 'all' || detectedStatus === filters.status;
  });

  return { matches, error };
}

export function mergeCatalogSelection(
  current: readonly string[],
  matches: readonly ApplicationCatalogItem[],
  limit = MAX_APPLICATION_PLAN_ITEMS,
): string[] {
  return Array.from(new Set([...current, ...matches.map((item) => item.key)])).slice(0, limit);
}
