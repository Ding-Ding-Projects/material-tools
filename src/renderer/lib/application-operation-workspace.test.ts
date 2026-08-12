import { describe, expect, it } from 'vitest';
import type { ApplicationOperationProgress, ApplicationOperationResult } from '../../shared/contracts';
import {
  isApplicationOperationPreviewStale,
  summarizeApplicationOperationResult,
  upsertApplicationOperationProgress,
} from './application-operation-workspace';

const queued: ApplicationOperationProgress = {
  operationId: 'operation-1',
  applicationId: 'firefox',
  name: 'Firefox',
  action: 'install',
  manager: 'winget',
  state: 'queued',
  completedCount: 0,
  totalCount: 2,
  message: 'Queued.',
};

describe('application operation workspace', () => {
  it('requires a fresh preview when either the action or selected catalog keys change', () => {
    const preview = {
      operationId: 'operation-1',
      planToken: 'a'.repeat(64),
      action: 'install' as const,
      state: 'ready' as const,
      createdAt: '2026-08-11T20:00:00.000Z',
      managers: [],
      items: [{
        applicationId: 'firefox' as const,
        name: 'Firefox',
        category: 'Browsers',
        manager: 'winget' as const,
        readiness: 'ready' as const,
      }],
    };

    expect(isApplicationOperationPreviewStale(preview, 'install', ['firefox'])).toBe(false);
    expect(isApplicationOperationPreviewStale(preview, 'upgrade', ['firefox'])).toBe(true);
    expect(isApplicationOperationPreviewStale(preview, 'install', ['git'])).toBe(true);
  });

  it('updates progress in place so one application never produces duplicate rows', () => {
    const running = { ...queued, state: 'running' as const, message: 'Installing.' };
    const next = upsertApplicationOperationProgress([queued], running);
    expect(next).toEqual([running]);
    expect(upsertApplicationOperationProgress(next, { ...queued, applicationId: 'vlc', name: 'VLC' })).toHaveLength(2);
  });

  it('summarizes every terminal result without turning partial work into success', () => {
    const result: ApplicationOperationResult = {
      operationId: 'operation-1',
      action: 'upgrade',
      state: 'partial',
      startedAt: '2026-08-11T20:00:00.000Z',
      completedAt: '2026-08-11T20:01:00.000Z',
      items: [
        { applicationId: 'firefox', name: 'Firefox', manager: 'winget', state: 'succeeded' },
        { applicationId: 'vlc', name: 'VLC', manager: 'winget', state: 'failed', reason: 'Package manager failed.' },
        { applicationId: 'git', name: 'Git', manager: null, state: 'unavailable', reason: 'No manager.' },
        { applicationId: '7zip', name: '7-Zip', manager: 'winget', state: 'cancelled', reason: 'Cancelled.' },
      ],
    };

    expect(summarizeApplicationOperationResult(result)).toEqual({
      succeeded: 1,
      failed: 1,
      cancelled: 1,
      unavailable: 1,
      total: 4,
    });
  });
});
