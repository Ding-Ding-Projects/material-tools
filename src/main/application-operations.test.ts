import { describe, expect, it, vi } from 'vitest';
import { APPLICATION_CATALOG } from '../shared/application-catalog.generated';
import type { ApplicationOperationProgress } from '../shared/contracts';
import {
  ApplicationOperationCoordinator,
} from './application-operations';
import type { CommandRunner } from './application-capabilities';

const tokenA = 'a'.repeat(64);

function availableWingetRunner(
  mutate?: (executable: string, args: readonly string[]) => Promise<void> | void,
): CommandRunner {
  return async (executable, args) => {
    if (args[0] === '--version') {
      if (executable === 'winget.exe') return { stdout: '1.10.0', stderr: '' };
      throw Object.assign(new Error('missing'), { code: 'ENOENT' });
    }
    await mutate?.(executable, args);
    if (args[0] === 'list') {
      const packageId = args[args.indexOf('--id') + 1];
      return { stdout: `Name Id Version Source\nApp ${packageId} 1.0 winget\n`, stderr: '' };
    }
    return { stdout: '', stderr: '' };
  };
}

describe('application operation coordinator', () => {
  it('previews generated catalog keys without exposing package identifiers or arguments', async () => {
    const coordinator = new ApplicationOperationCoordinator({
      platform: 'win32',
      runner: availableWingetRunner(),
      now: () => new Date('2026-08-11T17:00:00.000Z'),
      tokenFactory: () => tokenA,
    });
    const preview = await coordinator.preview({
      senderId: 7,
      operationId: 'app-operation-1-1',
      action: 'install',
      applicationKeys: ['7zip'],
    });
    expect(preview).toMatchObject({
      operationId: 'app-operation-1-1',
      planToken: tokenA,
      action: 'install',
      state: 'ready',
      items: [{ applicationId: '7zip', manager: 'winget', readiness: 'ready' }],
    });
    expect(JSON.stringify(preview)).not.toContain('7zip.7zip');
    expect(JSON.stringify(preview)).not.toContain('winget.exe');
    expect(JSON.stringify(preview)).not.toContain('--id');
  });

  it('rejects unlisted keys and an oversized request before command execution', async () => {
    const runner = vi.fn<CommandRunner>();
    const coordinator = new ApplicationOperationCoordinator({ platform: 'win32', runner });
    await expect(coordinator.preview({
      senderId: 7,
      operationId: 'app-operation-2-1',
      action: 'install',
      applicationKeys: ['renderer-supplied-package-id' as never],
    })).rejects.toThrow('unlisted catalog key');
    await expect(coordinator.preview({
      senderId: 7,
      operationId: 'app-operation-2-2',
      action: 'upgrade',
      applicationKeys: APPLICATION_CATALOG.slice(0, 26).map((item) => item.key),
    })).rejects.toThrow('1-25 catalog keys');
    expect(runner).not.toHaveBeenCalled();
  });

  it('derives fixed executable and package arguments from the catalog and verifies postcondition', async () => {
    const calls: Array<{ executable: string; args: readonly string[]; timeoutMs: number; maxBufferBytes: number }> = [];
    const runner = availableWingetRunner((executable, args) => {
      calls.push({ executable, args, timeoutMs: 0, maxBufferBytes: 0 });
    });
    const boundedRunner: CommandRunner = async (executable, args, options) => {
      calls.push({ executable, args, timeoutMs: options.timeoutMs, maxBufferBytes: options.maxBufferBytes });
      return runner(executable, args, options);
    };
    const coordinator = new ApplicationOperationCoordinator({
      platform: 'win32',
      runner: boundedRunner,
      tokenFactory: () => tokenA,
    });
    const preview = await coordinator.preview({
      senderId: 7,
      operationId: 'app-operation-3-1',
      action: 'install',
      applicationKeys: ['7zip'],
    });
    const result = await coordinator.execute({
      senderId: 7,
      operationId: preview.operationId,
      planToken: preview.planToken,
    });
    expect(result.state).toBe('completed');
    const mutation = calls.find((call) => call.args[0] === 'install');
    expect(mutation).toMatchObject({ executable: 'winget.exe' });
    expect(mutation?.args).toEqual([
      'install', '--id', '7zip.7zip', '--exact',
      '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity',
    ]);
    expect(mutation?.args).not.toContain('shell');
    expect(mutation?.timeoutMs).toBeLessThanOrEqual(5 * 60 * 1_000);
    expect(mutation?.maxBufferBytes).toBeLessThanOrEqual(1024 * 1024);
    expect(calls.some((call) => call.args[0] === 'list')).toBe(true);
  });

  it('downgrades a zero-exit mutation when installed-state verification fails', async () => {
    const runner: CommandRunner = async (executable, args) => {
      if (args[0] === '--version') {
        if (executable === 'winget.exe') return { stdout: '1.10.0', stderr: '' };
        throw Object.assign(new Error('missing'), { code: 'ENOENT' });
      }
      return { stdout: '', stderr: '' };
    };
    const coordinator = new ApplicationOperationCoordinator({
      platform: 'win32', runner, tokenFactory: () => tokenA,
    });
    const preview = await coordinator.preview({
      senderId: 7, operationId: 'app-operation-4-1', action: 'install', applicationKeys: ['7zip'],
    });
    const result = await coordinator.execute({ senderId: 7, operationId: preview.operationId, planToken: tokenA });
    expect(result).toMatchObject({ state: 'failed', items: [{ state: 'failed' }] });
  });

  it('consumes each plan token once and binds it to its previewing sender', async () => {
    const coordinator = new ApplicationOperationCoordinator({
      platform: 'win32', runner: availableWingetRunner(), tokenFactory: () => tokenA,
    });
    const preview = await coordinator.preview({
      senderId: 7, operationId: 'app-operation-5-1', action: 'upgrade', applicationKeys: ['git'],
    });
    await expect(coordinator.execute({ senderId: 8, operationId: preview.operationId, planToken: tokenA }))
      .rejects.toThrow('plan was rejected');
    await coordinator.execute({ senderId: 7, operationId: preview.operationId, planToken: tokenA });
    await expect(coordinator.execute({ senderId: 7, operationId: preview.operationId, planToken: tokenA }))
      .rejects.toThrow('plan was rejected');
  });

  it('keeps at most one pending preview per sender', async () => {
    let sequence = 0;
    const coordinator = new ApplicationOperationCoordinator({
      platform: 'win32',
      runner: availableWingetRunner(),
      tokenFactory: () => (++sequence).toString(16).padStart(64, '0'),
    });
    for (let index = 1; index <= 50; index += 1) {
      await coordinator.preview({
        senderId: 7,
        operationId: `app-operation-${index}-1`,
        action: 'install',
        applicationKeys: ['7zip'],
      });
      expect(coordinator.pendingPlanCount()).toBe(1);
    }
  });

  it('replaces a same-sender preview, rejects the old token, and executes the replacement', async () => {
    let sequence = 0;
    const coordinator = new ApplicationOperationCoordinator({
      platform: 'win32',
      runner: availableWingetRunner(),
      tokenFactory: () => (++sequence).toString(16).padStart(64, '0'),
    });
    const first = await coordinator.preview({
      senderId: 7, operationId: 'app-operation-51-1', action: 'install', applicationKeys: ['7zip'],
    });
    const second = await coordinator.preview({
      senderId: 7, operationId: 'app-operation-51-2', action: 'upgrade', applicationKeys: ['git'],
    });
    expect(coordinator.pendingPlanCount()).toBe(1);
    await expect(coordinator.execute({
      senderId: 7, operationId: first.operationId, planToken: first.planToken,
    })).rejects.toThrow('plan was rejected');
    await expect(coordinator.execute({
      senderId: 7, operationId: second.operationId, planToken: second.planToken,
    })).resolves.toMatchObject({ operationId: second.operationId, state: 'completed' });
  });

  it('lets only the owning sender discard a pending preview before a fresh preview', async () => {
    let sequence = 0;
    const coordinator = new ApplicationOperationCoordinator({
      platform: 'win32',
      runner: availableWingetRunner(),
      tokenFactory: () => (++sequence).toString(16).padStart(64, '0'),
    });
    const pending = await coordinator.preview({
      senderId: 7, operationId: 'app-operation-52-1', action: 'install', applicationKeys: ['7zip'],
    });
    expect(coordinator.cancel(8, pending.operationId)).toBe(false);
    await expect(coordinator.execute({
      senderId: 8, operationId: pending.operationId, planToken: pending.planToken,
    })).rejects.toThrow('plan was rejected');
    expect(coordinator.cancel(7, pending.operationId)).toBe(true);
    expect(coordinator.pendingPlanCount()).toBe(0);
    await expect(coordinator.preview({
      senderId: 7, operationId: 'app-operation-52-2', action: 'upgrade', applicationKeys: ['git'],
    })).resolves.toMatchObject({ operationId: 'app-operation-52-2' });
  });

  it('rejects and consumes an expired preview token', async () => {
    let nowMs = Date.parse('2026-08-11T17:00:00.000Z');
    const coordinator = new ApplicationOperationCoordinator({
      platform: 'win32',
      runner: availableWingetRunner(),
      now: () => new Date(nowMs),
      tokenFactory: () => tokenA,
    });
    const preview = await coordinator.preview({
      senderId: 7, operationId: 'app-operation-53-1', action: 'install', applicationKeys: ['7zip'],
    });
    nowMs += (5 * 60 * 1_000) + 1;
    await expect(coordinator.execute({
      senderId: 7, operationId: preview.operationId, planToken: preview.planToken,
    })).rejects.toThrow('expired');
    expect(coordinator.pendingPlanCount()).toBe(0);
    await expect(coordinator.execute({
      senderId: 7, operationId: preview.operationId, planToken: preview.planToken,
    })).rejects.toThrow('plan was rejected');
  });

  it('returns a structured no-manager result without running package commands', async () => {
    const runner: CommandRunner = vi.fn(async () => Promise.reject(Object.assign(new Error('missing'), { code: 'ENOENT' })));
    const coordinator = new ApplicationOperationCoordinator({
      platform: 'win32', runner, tokenFactory: () => tokenA,
    });
    const preview = await coordinator.preview({
      senderId: 7, operationId: 'app-operation-6-1', action: 'install', applicationKeys: ['7zip'],
    });
    expect(preview.state).toBe('unavailable');
    const result = await coordinator.execute({ senderId: 7, operationId: preview.operationId, planToken: tokenA });
    expect(result).toMatchObject({ state: 'failed', items: [{ state: 'unavailable', manager: null }] });
    expect(runner).toHaveBeenCalledTimes(2);
  });

  it('continues after one item fails and reports a partial result', async () => {
    const runner = availableWingetRunner((_executable, args) => {
      if (args[0] === 'install' && args.includes('7zip.7zip')) throw new Error('simulated failure');
    });
    const coordinator = new ApplicationOperationCoordinator({
      platform: 'win32', runner, tokenFactory: () => tokenA,
    });
    const preview = await coordinator.preview({
      senderId: 7,
      operationId: 'app-operation-7-1',
      action: 'install',
      applicationKeys: ['7zip', 'git'],
    });
    const result = await coordinator.execute({ senderId: 7, operationId: preview.operationId, planToken: tokenA });
    expect(result.state).toBe('partial');
    expect(result.items.map((item) => item.state)).toEqual(['failed', 'succeeded']);
  });

  it('emits deterministic fixture progress without invoking a mutation runner', async () => {
    const runner = vi.fn<CommandRunner>();
    const progress: ApplicationOperationProgress[] = [];
    const coordinator = new ApplicationOperationCoordinator({
      platform: 'win32',
      captureFixture: true,
      runner,
      tokenFactory: () => tokenA,
      fixtureStepDelayMs: 1,
    });
    const preview = await coordinator.preview({
      senderId: 7, operationId: 'app-operation-8-1', action: 'install', applicationKeys: ['7zip', 'git'],
    });
    const result = await coordinator.execute({
      senderId: 7,
      operationId: preview.operationId,
      planToken: tokenA,
      onProgress: (event) => progress.push(event),
    });
    expect(result.state).toBe('completed');
    expect(progress.map((event) => event.state)).toEqual([
      'queued', 'queued', 'running', 'succeeded', 'running', 'succeeded',
    ]);
    expect(progress.filter((event) => event.state === 'running' || event.state === 'succeeded')
      .every((event) => event.message.includes('no package-manager command'))).toBe(true);
    expect(result.items.every((item) => item.reason?.includes('no package-manager command'))).toBe(true);
    expect(runner).not.toHaveBeenCalled();
  });

  it('cancels only from the owning sender and reports remaining items cancelled', async () => {
    const coordinator = new ApplicationOperationCoordinator({
      platform: 'win32',
      captureFixture: true,
      tokenFactory: () => tokenA,
      fixtureStepDelayMs: 40,
    });
    const preview = await coordinator.preview({
      senderId: 7, operationId: 'app-operation-9-1', action: 'upgrade', applicationKeys: ['7zip', 'git'],
    });
    const execution = coordinator.execute({ senderId: 7, operationId: preview.operationId, planToken: tokenA });
    expect(coordinator.cancel(8, preview.operationId)).toBe(false);
    expect(coordinator.cancel(7, preview.operationId)).toBe(true);
    const result = await execution;
    expect(result.state).toBe('cancelled');
    expect(result.items.every((item) => item.state === 'cancelled')).toBe(true);
  });
});
