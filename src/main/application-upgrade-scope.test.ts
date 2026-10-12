import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApplicationCatalogId, ApplicationOperationProgress } from '../shared/contracts';
import type { CommandRunOptions, CommandRunner } from './application-capabilities';
import { ApplicationOperationCoordinator } from './application-operations';

// Every command in this suite is synthetic. Fail loudly if injection is lost.
const subprocessSentinel = vi.hoisted(() => vi.fn(() => {
  throw new Error('Real subprocesses are forbidden in upgrade-scope tests.');
}));
vi.mock('node:child_process', () => ({
  execFile: subprocessSentinel, exec: subprocessSentinel, spawn: subprocessSentinel, fork: subprocessSentinel,
  execFileSync: subprocessSentinel, execSync: subprocessSentinel, spawnSync: subprocessSentinel,
}));
afterEach(() => {
  // Catch even attempted real calls whose thrown error production would swallow.
  expect(subprocessSentinel).not.toHaveBeenCalled();
  subprocessSentinel.mockClear();
});

interface Call { executable: string; args: readonly string[]; options: CommandRunOptions }
function fakeMachine() {
  const versions = new Map<string, string>([['choco.exe', '2.4.3']]);
  const installed = new Map<string, Set<string>>([
    ['choco.exe', new Set(['git', 'github-desktop', 'vlc'])],
    ['winget.exe', new Set(['Git.Git', 'GitHub.GitHubDesktop', 'VideoLAN.VLC'])],
  ]);
  const calls: Call[] = [];
  const mutations: Call[] = [];
  const accidentalInstalls: string[] = [];
  const state = {
    queryError: false,
    errorOutput: '',
    queryOutput: undefined as string | undefined,
    beforeQuery: undefined as ((call: Call) => void) | undefined,
    beforeMutation: undefined as ((call: Call) => void) | undefined,
    afterMutation: undefined as ((call: Call) => void) | undefined,
  };
  const runner: CommandRunner = vi.fn(async (executable, args, options) => {
    const call = { executable, args: [...args], options };
    calls.push(call);
    if (options.signal?.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });
    if (args[0] === '--version') {
      if (!versions.has(executable)) throw Object.assign(new Error('Missing'), { code: 'ENOENT' });
      return { stdout: versions.get(executable)!, stderr: '' };
    }
    const id = executable === 'winget.exe' ? args[args.indexOf('--id') + 1]! : args[1]!;
    if (args[0] === 'list') {
      state.beforeQuery?.(call);
      if (state.queryError) throw Object.assign(new Error(`Synthetic query failure ${state.errorOutput}`), {
        stdout: state.errorOutput, stderr: state.errorOutput,
      });
      const stdout = state.queryOutput ?? (!installed.get(executable)!.has(id) ? ''
        : executable === 'choco.exe' ? `${id}|1.0.0\n` : `Name Id Version Source\nApp ${id} 1.0.0 winget\n`);
      return { stdout, stderr: '' };
    }
    if (args[0] !== 'install' && args[0] !== 'upgrade') throw new Error('Unexpected synthetic command');
    mutations.push(call);
    state.beforeMutation?.(call);
    const packages = installed.get(executable)!;
    if (!packages.has(id)) {
      if (args[0] === 'upgrade' && (executable === 'winget.exe' || args.includes('--fail-on-not-installed'))) {
        throw new Error('Not installed; manager refused upgrade');
      }
      accidentalInstalls.push(id);
      packages.add(id);
    }
    state.afterMutation?.(call);
    return { stdout: '', stderr: '' };
  });
  return { versions, installed, calls, mutations, accidentalInstalls, state, runner };
}

function setup(keys: readonly ApplicationCatalogId[] = ['githubdesktop'], action: 'upgrade' | 'install' = 'upgrade') {
  const machine = fakeMachine();
  const coordinator = new ApplicationOperationCoordinator({ platform: 'win32', runner: machine.runner });
  const request = { senderId: 7, operationId: 'app-operation-upgrade-scope-1', applicationKeys: keys, action };
  const preview = () => coordinator.preview(request);
  return { ...machine, coordinator, request, preview };
}

describe('upgrade installed-scope boundary (synthetic commands only)', () => {
  it.each([[], ['git'], ['github-desktop']])('rejects absent or partially installed GitHub Desktop IDs %j without mutation', async (ids) => {
    const test = setup();
    test.installed.set('choco.exe', new Set(ids));
    const preview = await test.preview();
    expect(preview.state).toBe('unavailable');
    expect(preview.items[0]?.readiness).toBe('unavailable');
    expect(preview.items[0]?.reason).toBeTruthy();
    const result = await test.coordinator.execute({ ...preview, senderId: 7 });
    expect(result.state).toBe('failed');
    expect(result.items[0]?.state).toBe('unavailable');
    expect(test.mutations).toEqual([]);
    expect(test.accidentalInstalls).toEqual([]);
  });

  it('does not turn an unavailable preview into permission when packages appear later', async () => {
    const test = setup();
    test.installed.get('choco.exe')!.clear();
    const preview = await test.preview();
    test.installed.set('choco.exe', new Set(['git', 'github-desktop']));
    const result = await test.coordinator.execute({ ...preview, senderId: 7 });
    expect(preview.state).toBe('unavailable');
    expect(result.items[0]?.state).toBe('unavailable');
    expect(test.mutations).toEqual([]);
  });

  it.each(['git', 'github-desktop'])('rechecks every ID before the first mutation when %s is removed after preview', async (removed) => {
    const test = setup();
    const preview = await test.preview();
    expect(preview.state).toBe('ready');
    test.installed.get('choco.exe')!.delete(removed);
    const result = await test.coordinator.execute({ ...preview, senderId: 7 });
    expect(result.items[0]?.state).toBe('unavailable');
    expect(test.mutations).toEqual([]);
    expect(test.accidentalInstalls).toEqual([]);
  });

  it('sends fixed Chocolatey upgrade-only guards for every generated package ID', async () => {
    const test = setup();
    const preview = await test.preview();
    const result = await test.coordinator.execute({ ...preview, senderId: 7 });
    expect(result.state).toBe('completed');
    expect(test.mutations.map((call) => call.args)).toEqual(['git', 'github-desktop'].map((id) => [
      'upgrade', id, '--yes', '--no-progress', '--limit-output', '--no-color', '--fail-on-not-installed',
    ]));
    expect(test.mutations.every((call) => call.executable === 'choco.exe'
      && call.options.timeoutMs <= 300_000 && call.options.maxBufferBytes <= 1024 * 1024)).toBe(true);
    const firstMutation = test.calls.findIndex((call) => call.args[0] === 'upgrade');
    for (const id of ['git', 'github-desktop']) {
      expect(test.calls.slice(0, firstMutation).filter((call) => call.args[0] === 'list' && call.args[1] === id)).toHaveLength(2);
    }
  });

  it('makes Chocolatey itself refuse a package removed after preflight but before invocation', async () => {
    const test = setup(['git']);
    const preview = await test.preview();
    test.state.beforeMutation = () => { test.installed.get('choco.exe')!.delete('git'); };
    const result = await test.coordinator.execute({ ...preview, senderId: 7 });
    expect(test.mutations).toHaveLength(1);
    expect(test.mutations[0]?.args).toContain('--fail-on-not-installed');
    expect(test.accidentalInstalls).toEqual([]);
    expect(result.items[0]?.state).toBe('failed');
  });

  it('keeps WinGet preferred and does not substitute installed Chocolatey packages for its absent package', async () => {
    const test = setup();
    test.versions.set('winget.exe', '1.10.0');
    test.installed.get('winget.exe')!.clear();
    const preview = await test.preview();
    expect(preview.state).toBe('unavailable');
    await test.coordinator.execute({ ...preview, senderId: 7 });
    expect(test.mutations).toEqual([]);
  });

  it('retains fixed WinGet arguments and requires its installed state again at execution', async () => {
    const test = setup(['git']);
    test.versions.set('winget.exe', '1.10.0');
    const preview = await test.preview();
    expect(preview.items[0]?.manager).toBe('winget');
    const result = await test.coordinator.execute({ ...preview, senderId: 7 });
    expect(result.state).toBe('completed');
    expect(test.mutations.map((call) => call.args)).toEqual([[
      'upgrade', '--id', 'Git.Git', '--exact', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity',
    ]]);
  });

  it.each(['package removed', 'manager disappeared'])('refuses WinGet upgrade when %s after preview without falling back to Chocolatey', async (change) => {
    const test = setup(['git']);
    test.versions.set('winget.exe', '1.10.0');
    const preview = await test.preview();
    if (change === 'package removed') test.installed.get('winget.exe')!.clear();
    else test.versions.delete('winget.exe');
    const result = await test.coordinator.execute({ ...preview, senderId: 7 });
    expect(result.items[0]).toMatchObject({ manager: 'winget', state: 'unavailable' });
    expect(test.mutations).toEqual([]);
  });

  it.each(['choco.exe', 'winget.exe'])('requires a valid installed-package version from %s instead of a matching ID alone', async (manager) => {
    const test = setup(['git']);
    if (manager === 'winget.exe') test.versions.set(manager, '1.10.0');
    test.state.queryOutput = manager === 'winget.exe' ? 'App Git.Git unknown winget\n' : 'git|unknown\n';
    const preview = await test.preview();
    expect(preview.state).toBe('unavailable');
    await test.coordinator.execute({ ...preview, senderId: 7 });
    expect(test.mutations).toEqual([]);
  });

  it('does not use another manager to pass post-verification for the selected manager', async () => {
    const test = setup(['git']);
    test.versions.set('winget.exe', '1.10.0');
    const preview = await test.preview();
    test.state.afterMutation = () => { test.installed.get('winget.exe')!.clear(); };
    const result = await test.coordinator.execute({ ...preview, senderId: 7 });
    expect(result.items[0]).toMatchObject({ manager: 'winget', state: 'failed' });
    expect(test.mutations.every((call) => call.executable === 'winget.exe')).toBe(true);
  });

  it('keeps the preview-selected Chocolatey manager when WinGet appears before execution', async () => {
    const test = setup(['git']);
    const preview = await test.preview();
    test.versions.set('winget.exe', '1.10.0');
    test.state.afterMutation = () => { test.installed.get('choco.exe')!.clear(); };
    const result = await test.coordinator.execute({ ...preview, senderId: 7 });
    expect(result.items[0]).toMatchObject({ manager: 'chocolatey', state: 'failed' });
    expect(test.mutations.every((call) => call.executable === 'choco.exe')).toBe(true);
  });

  it.each(['1.4.0', '2', '2banana', '2.0.0garbage', 'unknown', ''])('fails closed for unsupported or malformed Chocolatey version %j', async (version) => {
    const test = setup();
    test.versions.set('choco.exe', version);
    const preview = await test.preview();
    expect(preview.state).toBe('unavailable');
    await test.coordinator.execute({ ...preview, senderId: 7 });
    expect(test.mutations).toEqual([]);
  });

  it('fails closed when no manager exists, even if one appears after preview', async () => {
    const test = setup();
    test.versions.clear();
    const preview = await test.preview();
    test.versions.set('choco.exe', '2.4.3');
    expect(preview.state).toBe('unavailable');
    const result = await test.coordinator.execute({ ...preview, senderId: 7 });
    expect(result.items[0]?.state).toBe('unavailable');
    expect(test.mutations).toEqual([]);
  });

  it.each(['missing', 'old', 'malformed'])('fails closed when selected manager becomes %s after preview', async (change) => {
    const test = setup();
    const preview = await test.preview();
    if (change === 'missing') test.versions.delete('choco.exe');
    else test.versions.set('choco.exe', change === 'old' ? '1.4.0' : '2invalid');
    const result = await test.coordinator.execute({ ...preview, senderId: 7 });
    expect(result.items[0]?.state).toBe('unavailable');
    expect(test.mutations).toEqual([]);
  });

  it.each(['error', 'nonmatch'])('fails closed on %s installed-state evidence at preview', async (failure) => {
    const test = setup();
    if (failure === 'error') test.state.queryError = true;
    else test.state.queryOutput = 'git-extra|1.0.0\ngithub-desktop-extra|1.0.0\n';
    const preview = await test.preview();
    expect(preview.state).toBe('unavailable');
    await test.coordinator.execute({ ...preview, senderId: 7 });
    expect(test.mutations).toEqual([]);
  });

  it.each(['error', 'nonmatch'])('fails closed on %s installed-state evidence at execution', async (failure) => {
    const test = setup();
    const preview = await test.preview();
    if (failure === 'error') test.state.queryError = true;
    else test.state.queryOutput = 'git-extra|1.0.0\ngithub-desktop-extra|1.0.0\n';
    const result = await test.coordinator.execute({ ...preview, senderId: 7 });
    expect(result.items[0]?.state).toBe('unavailable');
    expect(test.mutations).toEqual([]);
  });

  it('preserves partial counts, throwing progress delivery, one-use tokens and cleanup', async () => {
    const test = setup(['githubdesktop', 'git', 'vlc']);
    test.installed.get('choco.exe')!.delete('github-desktop');
    const preview = await test.preview();
    test.installed.get('choco.exe')!.delete('vlc');
    const progress: ApplicationOperationProgress[] = [];
    await expect(test.coordinator.execute({ ...preview, senderId: 8 })).rejects.toThrow('plan was rejected');
    const result = await test.coordinator.execute({ ...preview, senderId: 7, onProgress: (event) => {
      progress.push(event);
      throw new Error('Synthetic delivery failure');
    } });
    expect(result.state).toBe('partial');
    expect(result.items.map((item) => item.state)).toEqual(['unavailable', 'succeeded', 'unavailable']);
    const terminal = progress.filter((event) => !['queued', 'running'].includes(event.state));
    expect(terminal.map((event) => event.completedCount)).toEqual([1, 2, 3]);
    expect(terminal.map((event) => event.applicationId)).toEqual(['githubdesktop', 'git', 'vlc']);
    expect(test.mutations.map((call) => call.args[1])).toEqual(['git']);
    expect(test.coordinator.hasLifecycle()).toBe(false);
    await expect(test.coordinator.execute({ ...preview, senderId: 7 })).rejects.toThrow('plan was rejected');
    const next = await test.preview();
    expect(next.planToken).not.toBe(preview.planToken);
    expect(test.coordinator.cancel(7, next.operationId)).toBe(true);
  });

  it.each(['preview query', 'execution query', 'mutation'])('does not expose private command output from a failed %s', async (phase) => {
    const test = setup(['git']);
    const secret = 'SYNTHETIC_PRIVATE_OUTPUT_MUST_NOT_LEAK';
    test.state.errorOutput = secret;
    if (phase === 'preview query') test.state.queryError = true;
    const preview = await test.preview();
    if (phase === 'execution query') test.state.queryError = true;
    if (phase === 'mutation') test.state.beforeMutation = () => {
      throw Object.assign(new Error(secret), { stdout: secret, stderr: secret });
    };
    const progress: ApplicationOperationProgress[] = [];
    const result = await test.coordinator.execute({ ...preview, senderId: 7, onProgress: (event) => { progress.push(event); } });
    expect(result.state).toBe('failed');
    expect(JSON.stringify({ preview, result, progress })).not.toContain(secret);
    if (phase !== 'mutation') expect(test.mutations).toEqual([]);
  });

  it('honors cancellation during execution preflight before any mutation and cleans up', async () => {
    const test = setup(['githubdesktop', 'vlc']);
    const preview = await test.preview();
    const progress: ApplicationOperationProgress[] = [];
    test.state.beforeQuery = () => {
      expect(test.coordinator.cancel(8, preview.operationId)).toBe(false);
      expect(test.coordinator.cancel(7, preview.operationId)).toBe(true);
    };
    const result = await test.coordinator.execute({ ...preview, senderId: 7, onProgress: (event) => { progress.push(event); } });
    expect(result.state).toBe('cancelled');
    expect(result.items.map((item) => item.state)).toEqual(['cancelled', 'cancelled']);
    expect(test.mutations).toEqual([]);
    expect(progress.filter((event) => event.state === 'cancelled').map((event) => event.completedCount)).toEqual([1, 2]);
    expect(test.coordinator.hasLifecycle()).toBe(false);
  });

  it('leaves explicit Install behavior and arguments unchanged for absent packages and older Chocolatey', async () => {
    const test = setup(['githubdesktop'], 'install');
    test.versions.set('choco.exe', '1.4.0');
    test.installed.get('choco.exe')!.clear();
    const preview = await test.preview();
    expect(preview.state).toBe('ready');
    expect(test.calls.every((call) => call.args[0] === '--version')).toBe(true);
    const result = await test.coordinator.execute({ ...preview, senderId: 7 });
    expect(result.state).toBe('completed');
    expect(test.mutations.map((call) => call.args)).toEqual(['git', 'github-desktop'].map((id) => [
      'install', id, '--yes', '--no-progress', '--limit-output', '--no-color',
    ]));
  });

  it('keeps capture-only Upgrade fixtures isolated from every command runner', async () => {
    const runner = vi.fn<CommandRunner>(async () => { throw new Error('Fixture invoked a command'); });
    const coordinator = new ApplicationOperationCoordinator({ platform: 'win32', captureFixture: true, fixtureStepDelayMs: 0, runner });
    const preview = await coordinator.preview({ senderId: 7, operationId: 'app-operation-upgrade-fixture-1', action: 'upgrade', applicationKeys: ['githubdesktop'] });
    const result = await coordinator.execute({ ...preview, senderId: 7 });
    expect(result.state).toBe('completed');
    expect(result.items[0]?.reason).toContain('fixture');
    expect(runner).not.toHaveBeenCalled();
  });
});
