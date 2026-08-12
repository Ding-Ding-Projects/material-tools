import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_SOURCE = readFileSync(fileURLToPath(new URL('../App.tsx', import.meta.url)), 'utf8');
const ILLUSTRATION_SOURCE = readFileSync(fileURLToPath(new URL('../action-illustrations.ts', import.meta.url)), 'utf8');
const STYLE_SOURCE = readFileSync(fileURLToPath(new URL('../styles.css', import.meta.url)), 'utf8');

const REQUIRED_INSTALL_MARKERS = [
  'MAX_APPLICATION_PLAN_ITEMS',
  'MAX_APPLICATION_CAPABILITY_KEYS',
  'scanScopeLabel',
  'startup does not scan automatically',
  'filterApplicationCatalog(',
  'application-catalog--${view}',
  'Preview ${operationAction} for ${selectedItems.length}',
  'Confirm and ${operationPreview.action}',
  'operation-progress__items',
  'Cancel operation',
  'operation-result__items',
  'Verify ${operationResult.items.length}',
  'previewApplicationOperation(action, applicationKeys)',
  'executeApplicationOperation(preview.operationId, preview.planToken)',
  'cancelApplicationOperation(operationId)',
  'onApplicationOperationProgress(',
];

const REQUIRED_INSTALL_ILLUSTRATIONS = [
  ['applicationsCatalog', 'applications-catalog'],
  ['packageManagerReadiness', 'package-manager-readiness'],
  ['operationPlan', 'operation-plan'],
  ['operationProgress', 'operation-progress'],
  ['operationRecovery', 'operation-recovery'],
];

const REQUIRED_INSTALL_STYLES = [
  '.application-catalog',
  '.manager-section',
  '.review-plan',
  '.operation-workspace',
  '.operation-preview',
  '.operation-progress',
  '.operation-result',
];

const REQUIRED_MOBILE_TOUCH_RULES = [
  '.filter-chip-row button { min-height: 48px;',
  '.catalog-actions .segmented-control button { min-height: 48px;',
  '.tab-rail [role="tab"] { width: 48px;',
  '.regex-builder__surface, .rail-search .regex-builder__surface { position: fixed;',
  '.regex-builder__guide button, .regex-builder__token-groups button, .regex-builder__actions button { min-height: 48px;',
];

describe('dense Install workspace completeness', () => {
  it('keeps the hand-written scan, selection, operation, and verification workflow present', () => {
    for (const marker of REQUIRED_INSTALL_MARKERS) expect(APP_SOURCE, marker).toContain(marker);
    expect(APP_SOURCE).not.toContain('useEffect(() => { refreshAppCapabilities();');
    expect(APP_SOURCE).toContain('selected.size > 0');
    expect(APP_SOURCE).toContain('matches.slice(0, MAX_APPLICATION_CAPABILITY_KEYS)');
    expect(APP_SOURCE).toContain('current.length < MAX_APPLICATION_PLAN_ITEMS');
  });

  it('binds every required Install illustration through the shared inventory and real surface', () => {
    for (const [binding, id] of REQUIRED_INSTALL_ILLUSTRATIONS) {
      expect(ILLUSTRATION_SOURCE).toContain(`${binding}: '${id}'`);
      expect(APP_SOURCE).toContain(`ACTION_ILLUSTRATION_BINDINGS.surfaces.${binding}`);
    }
  });

  it('keeps each major Install surface styled instead of falling back to an empty document flow', () => {
    for (const selector of REQUIRED_INSTALL_STYLES) expect(STYLE_SOURCE, selector).toContain(selector);
    for (const rule of REQUIRED_MOBILE_TOUCH_RULES) expect(STYLE_SOURCE, rule).toContain(rule);
  });
});
