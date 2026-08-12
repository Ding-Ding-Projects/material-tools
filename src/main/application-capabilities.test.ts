import { describe, expect, it, vi } from 'vitest';
import { APPLICATION_CATALOG } from '../shared/application-catalog.generated';
import {
  createApplicationCapabilityFixture,
  readApplicationCapabilitySnapshot,
  type CommandRunner,
} from './application-capabilities';

const requestedKeys = ['7zip', 'firefox', 'git'] as const;

function missingExecutable(): Error & { code: string } {
  return Object.assign(new Error('not found'), { code: 'ENOENT' });
}

describe('application capability service', () => {
  it('detects package-manager versions and requested installed states', async () => {
    const runner: CommandRunner = vi.fn(async (executable, args) => {
      if (args[0] === '--version') {
        return { stdout: executable === 'winget.exe' ? 'v1.9.25200\r\n' : '2.4.1\n', stderr: '' };
      }
      const packageId = args[args.indexOf('--id') + 1];
      if (executable === 'winget.exe' && packageId === '7zip.7zip') {
        return { stdout: 'Name  Id  Version  Source\n7-Zip  7zip.7zip  24.09  winget\n', stderr: '' };
      }
      if (executable === 'choco.exe' && args.includes('firefox')) {
        return { stdout: 'firefox|128.0.0\n', stderr: '' };
      }
      return { stdout: '', stderr: '' };
    });

    const snapshot = await readApplicationCapabilitySnapshot({
      operationId: 'app-capabilities-1-1',
      applicationKeys: requestedKeys,
      runner,
      platform: 'win32',
      now: () => new Date('2026-08-11T16:00:00.000Z'),
    });

    expect(snapshot.state).toBe('completed');
    expect(snapshot.checkedAt).toBe('2026-08-11T16:00:00.000Z');
    expect(snapshot.managers).toEqual([
      { id: 'winget', label: 'WinGet', status: 'available', version: '1.9.25200' },
      { id: 'chocolatey', label: 'Chocolatey', status: 'available', version: '2.4.1' },
    ]);
    expect(snapshot.applications).toHaveLength(requestedKeys.length);
    expect(snapshot.applications.find((app) => app.id === '7zip')).toMatchObject({
      status: 'installed', manager: 'winget', version: '24.09',
    });
    expect(snapshot.applications.find((app) => app.id === 'firefox')).toMatchObject({
      status: 'installed', manager: 'chocolatey', version: '128.0.0',
    });
    expect(snapshot.applications.find((app) => app.id === 'git')).toMatchObject({
      status: 'not-installed', manager: null,
    });
  });

  it('executes only fixed manager binaries and generated catalog identifiers within hard bounds', async () => {
    const invocations: Array<{ executable: string; args: readonly string[]; timeoutMs: number; maxBufferBytes: number }> = [];
    const runner: CommandRunner = async (executable, args, options) => {
      invocations.push({ executable, args, timeoutMs: options.timeoutMs, maxBufferBytes: options.maxBufferBytes });
      if (args[0] === '--version') return { stdout: '1.0.0', stderr: '' };
      return { stdout: '', stderr: '' };
    };

    await readApplicationCapabilitySnapshot({
      operationId: 'app-capabilities-2-1',
      applicationKeys: requestedKeys,
      runner,
      platform: 'win32',
    });

    const requestedEntries = APPLICATION_CATALOG.filter((entry) => requestedKeys.some((key) => key === entry.key));
    const allowedIds = new Set<string>(requestedEntries.flatMap((entry) => [
      ...entry.winget.map((id) => id.replace(/^msstore:/, '')),
      ...entry.choco,
    ]));
    expect(new Set(invocations.map((invocation) => invocation.executable))).toEqual(new Set(['winget.exe', 'choco.exe']));
    for (const invocation of invocations) {
      expect(invocation.timeoutMs).toBeLessThanOrEqual(12_000);
      expect(invocation.maxBufferBytes).toBeLessThanOrEqual(256 * 1024);
      if (invocation.args[0] === '--version') continue;
      const packageId = invocation.executable === 'winget.exe'
        ? invocation.args[invocation.args.indexOf('--id') + 1]
        : invocation.args[1];
      expect(allowedIds.has(packageId)).toBe(true);
      if (invocation.executable === 'choco.exe') expect(invocation.args).not.toContain('--local-only');
    }
  });

  it('rejects an unlisted catalog key at the service boundary', async () => {
    await expect(readApplicationCapabilitySnapshot({
      operationId: 'app-capabilities-2-2',
      applicationKeys: ['not-a-generated-catalog-key' as never],
      runner: vi.fn(),
      platform: 'win32',
    })).rejects.toThrow('unlisted catalog key');
  });

  it('deduplicates requested catalog keys', async () => {
    const runner: CommandRunner = async (_executable, args) => (
      args[0] === '--version' ? { stdout: '1.0.0', stderr: '' } : { stdout: '', stderr: '' }
    );
    const snapshot = await readApplicationCapabilitySnapshot({
      operationId: 'app-capabilities-2-3',
      applicationKeys: ['7zip', '7zip'],
      runner,
      platform: 'win32',
    });
    expect(snapshot.applications.map((item) => item.id)).toEqual(['7zip']);
  });

  it('reports unavailable managers without installed-state commands', async () => {
    const runner: CommandRunner = vi.fn(async () => Promise.reject(missingExecutable()));
    const snapshot = await readApplicationCapabilitySnapshot({
      operationId: 'app-capabilities-3-1',
      applicationKeys: requestedKeys,
      runner,
      platform: 'win32',
    });
    expect(snapshot.managers.every((manager) => manager.status === 'unavailable')).toBe(true);
    expect(snapshot.applications.every((app) => app.status === 'unknown' && app.manager === null)).toBe(true);
    expect(runner).toHaveBeenCalledTimes(2);
  });

  it('does not claim absence when a manager query fails', async () => {
    const runner: CommandRunner = async (executable, args) => {
      if (args[0] === '--version') return { stdout: '1.0.0', stderr: '' };
      if (executable === 'winget.exe' && args.includes('Git.Git')) throw new Error('query failed');
      return { stdout: '', stderr: '' };
    };
    const snapshot = await readApplicationCapabilitySnapshot({
      operationId: 'app-capabilities-4-1',
      applicationKeys: ['git'],
      runner,
      platform: 'win32',
    });
    expect(snapshot.applications[0]).toMatchObject({ status: 'unknown', manager: null });
  });

  it('recognizes the documented WinGet no-applications exit as not installed', async () => {
    const runner: CommandRunner = async (_executable, args) => {
      if (args[0] === '--version') return { stdout: '1.0.0', stderr: '' };
      if (args[0] === 'list' && args.includes('--id')) {
        throw Object.assign(new Error('no applications'), {
          code: -1978335212,
          stdout: 'No installed package found matching input criteria.\n',
        });
      }
      return { stdout: '', stderr: '' };
    };
    const snapshot = await readApplicationCapabilitySnapshot({
      operationId: 'app-capabilities-4-2',
      applicationKeys: requestedKeys,
      runner,
      platform: 'win32',
    });
    expect(snapshot.applications.every((app) => app.status === 'not-installed')).toBe(true);
  });

  it('returns unsupported states without spawning managers off Windows', async () => {
    const runner: CommandRunner = vi.fn();
    const snapshot = await readApplicationCapabilitySnapshot({
      operationId: 'app-capabilities-5-1',
      applicationKeys: requestedKeys,
      runner,
      platform: 'linux',
    });
    expect(runner).not.toHaveBeenCalled();
    expect(snapshot.managers.every((manager) => manager.status === 'unsupported')).toBe(true);
  });

  it('propagates cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    const runner: CommandRunner = async (_executable, _args, options) => {
      if (options.signal?.aborted) {
        const error = new Error('cancelled');
        error.name = 'AbortError';
        throw error;
      }
      return { stdout: '1.0.0', stderr: '' };
    };
    await expect(readApplicationCapabilitySnapshot({
      operationId: 'app-capabilities-6-1',
      applicationKeys: requestedKeys,
      runner,
      platform: 'win32',
      signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('returns a deterministic requested-subset fixture', () => {
    const snapshot = createApplicationCapabilityFixture('app-capabilities-7-1', requestedKeys);
    expect(snapshot).toMatchObject({
      operationId: 'app-capabilities-7-1',
      state: 'completed',
      checkedAt: '2026-08-11T00:00:00.000Z',
    });
    expect(snapshot.applications.map((item) => item.id)).toEqual(requestedKeys);
  });
});
