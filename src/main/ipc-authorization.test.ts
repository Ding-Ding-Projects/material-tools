import { describe, expect, it } from 'vitest';
import {
  canStartApplicationCapabilityScan,
  canStartApplicationOperationExecution,
  canStartApplicationOperationPreview,
  isAuthorizedIpcSender,
  isValidApplicationOperationAction,
  isValidApplicationOperationId,
  isValidApplicationPlanToken,
  isValidAppCapabilityOperationId,
  normalizeApplicationCapabilityKeys,
  normalizeApplicationOperationKeys,
  readAppCapabilityCancelOperationId,
} from './ipc-authorization';

describe('main-process IPC authorization', () => {
  const rendererUrl = 'file:///C:/Program%20Files/Material%20Tools/resources/app.asar/dist/renderer/index.html';

  it('accepts only the expected web contents on the exact renderer URL', () => {
    expect(isAuthorizedIpcSender({
      expectedWebContentsId: 7,
      senderWebContentsId: 7,
      senderFrameUrl: rendererUrl,
      rendererUrl,
    })).toBe(true);
  });

  it('rejects another web contents and untrusted frames', () => {
    expect(isAuthorizedIpcSender({
      expectedWebContentsId: 7,
      senderWebContentsId: 8,
      senderFrameUrl: rendererUrl,
      rendererUrl,
    })).toBe(false);
    for (const senderFrameUrl of [
      'https://example.com/',
      'file:///C:/Program%20Files/Material%20Tools/resources/app.asar/dist/renderer/other.html',
    ]) {
      expect(isAuthorizedIpcSender({
        expectedWebContentsId: 7,
        senderWebContentsId: 7,
        senderFrameUrl,
        rendererUrl,
      })).toBe(false);
    }
  });

  it('accepts only bounded generated operation identifiers and plan tokens', () => {
    expect(isValidAppCapabilityOperationId('app-capabilities-1723412345678-1')).toBe(true);
    expect(isValidApplicationOperationId('app-operation-1723412345678-1')).toBe(true);
    expect(isValidApplicationPlanToken('a'.repeat(64))).toBe(true);
    expect(isValidApplicationPlanToken('A'.repeat(64))).toBe(false);
    for (const value of ['', 'app-capabilities-1', 'app-capabilities-1-1;calc.exe', '../app-capabilities-1-1', null, 1]) {
      expect(isValidAppCapabilityOperationId(value)).toBe(false);
    }
  });

  it('accepts the preload capability-cancel shape without requiring scan keys', () => {
    expect(readAppCapabilityCancelOperationId({ operationId: 'app-capabilities-1723412345678-1' }))
      .toBe('app-capabilities-1723412345678-1');
    expect(readAppCapabilityCancelOperationId({
      operationId: 'app-capabilities-1723412345678-1;calc.exe',
      applicationKeys: ['7zip'],
    })).toBeNull();
  });

  it('validates actions and rejects uninstall', () => {
    expect(isValidApplicationOperationAction('install')).toBe(true);
    expect(isValidApplicationOperationAction('upgrade')).toBe(true);
    expect(isValidApplicationOperationAction('uninstall')).toBe(false);
  });

  it('validates, deduplicates, and bounds full-catalog scan keys', () => {
    expect(normalizeApplicationCapabilityKeys(['7zip', '7zip', 'git'])).toEqual(['7zip', 'git']);
    expect(normalizeApplicationCapabilityKeys(['not-a-catalog-key'])).toBeNull();
    expect(normalizeApplicationCapabilityKeys(Array.from({ length: 65 }, () => '7zip'))).toBeNull();
  });

  it('bounds operation keys to 25 before deduplication', () => {
    expect(normalizeApplicationOperationKeys(['7zip', '7zip', 'git'])).toEqual(['7zip', 'git']);
    expect(normalizeApplicationOperationKeys(['not-a-catalog-key'])).toBeNull();
    expect(normalizeApplicationOperationKeys(Array.from({ length: 26 }, () => '7zip'))).toBeNull();
  });

  it('keeps capability scans, previews, and execution lifecycles mutually exclusive', () => {
    const idle = {
      activeCapabilityQueryCount: 0,
      applicationOperationPreviewActive: false,
      applicationOperationExecutionActive: false,
      applicationOperationPendingPlanActive: false,
    };
    expect(canStartApplicationCapabilityScan(idle)).toBe(true);
    expect(canStartApplicationOperationPreview(idle)).toBe(true);
    expect(canStartApplicationOperationExecution(idle)).toBe(false);

    const scanning = { ...idle, activeCapabilityQueryCount: 1 };
    expect(canStartApplicationCapabilityScan(scanning)).toBe(false);
    expect(canStartApplicationOperationPreview(scanning)).toBe(false);
    expect(canStartApplicationOperationExecution({ ...scanning, applicationOperationPendingPlanActive: true })).toBe(false);

    const planned = { ...idle, applicationOperationPendingPlanActive: true };
    expect(canStartApplicationCapabilityScan(planned)).toBe(false);
    expect(canStartApplicationOperationPreview(planned)).toBe(true);
    expect(canStartApplicationOperationExecution(planned)).toBe(true);

    const executing = { ...planned, applicationOperationExecutionActive: true };
    expect(canStartApplicationCapabilityScan(executing)).toBe(false);
    expect(canStartApplicationOperationPreview(executing)).toBe(false);
    expect(canStartApplicationOperationExecution(executing)).toBe(false);

    const previewing = { ...idle, applicationOperationPreviewActive: true };
    expect(canStartApplicationCapabilityScan(previewing)).toBe(false);
    expect(canStartApplicationOperationPreview(previewing)).toBe(false);
    expect(canStartApplicationOperationExecution({ ...previewing, applicationOperationPendingPlanActive: true })).toBe(false);
  });
});
