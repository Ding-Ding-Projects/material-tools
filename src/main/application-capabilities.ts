import { execFile } from 'node:child_process';
import {
  APPLICATION_CATALOG,
  type ApplicationCatalogItem,
} from '../shared/application-catalog.generated';
import {
  MAX_APPLICATION_CAPABILITY_KEYS,
  type ApplicationCapabilitySnapshot,
  type ApplicationCatalogId,
  type ApplicationInstalledState,
  type PackageManagerCapability,
  type PackageManagerId,
} from '../shared/contracts';

export const CAPABILITY_TIMEOUT_MS = 4_000;
const QUERY_TIMEOUT_MS = 12_000;
export const CAPABILITY_MAX_BUFFER_BYTES = 64 * 1024;
const QUERY_MAX_BUFFER_BYTES = 256 * 1024;
const QUERY_CONCURRENCY = 3;
const WINGET_NO_APPLICATIONS_FOUND = -1978335212;
const ANSI_ESCAPE = /\u001b\[[0-?]*[ -/]*[@-~]/g;

export interface CommandRunOptions {
  signal?: AbortSignal;
  timeoutMs: number;
  maxBufferBytes: number;
}

export interface CommandRunResult {
  stdout: string;
  stderr: string;
}

export type CommandRunner = (
  executable: string,
  args: readonly string[],
  options: CommandRunOptions,
) => Promise<CommandRunResult>;

export interface ReadApplicationCapabilitiesOptions {
  operationId: string;
  applicationKeys: readonly ApplicationCatalogId[];
  runner?: CommandRunner;
  platform: string;
  signal?: AbortSignal;
  now?: () => Date;
}

interface PackageQueryResult {
  state: 'installed' | 'not-installed' | 'error';
  manager: PackageManagerId;
  version?: string;
}

export const APPLICATION_PACKAGE_MANAGERS = [
  {
    id: 'winget' as const,
    label: 'WinGet',
    executable: 'winget.exe',
    versionArgs: ['--version'] as const,
  },
  {
    id: 'chocolatey' as const,
    label: 'Chocolatey',
    executable: 'choco.exe',
    versionArgs: ['--version'] as const,
  },
] as const;

export const defaultCommandRunner: CommandRunner = (executable, args, options) => new Promise((resolve, reject) => {
  execFile(executable, [...args], {
    encoding: 'utf8',
    maxBuffer: options.maxBufferBytes,
    signal: options.signal,
    timeout: options.timeoutMs,
    windowsHide: true,
  }, (error, stdout, stderr) => {
    if (error) {
      Object.assign(error, { stdout: String(stdout), stderr: String(stderr) });
      reject(error);
      return;
    }
    resolve({ stdout: String(stdout), stderr: String(stderr) });
  });
});

function isAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'AbortError' || Reflect.get(error, 'code') === 'ABORT_ERR';
}

function isExecutableMissing(error: unknown): boolean {
  return error instanceof Error && Reflect.get(error, 'code') === 'ENOENT';
}

function cleanOutput(value: string): string {
  return value.replace(ANSI_ESCAPE, '').replace(/\0/g, '').slice(0, QUERY_MAX_BUFFER_BYTES);
}

function isWingetNoApplicationsFound(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (Reflect.get(error, 'code') === WINGET_NO_APPLICATIONS_FOUND) return true;
  const stdout = String(Reflect.get(error, 'stdout') ?? '');
  const stderr = String(Reflect.get(error, 'stderr') ?? '');
  return cleanOutput(`${stdout}\n${stderr}`).includes('No installed package found matching input criteria.');
}

function cleanVersion(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const candidate = cleanOutput(value).trim().replace(/^v(?=\d)/i, '').slice(0, 80);
  return /^[0-9][0-9A-Za-z.+_-]{0,79}$/.test(candidate) ? candidate : undefined;
}

export async function detectPackageManager(
  manager: typeof APPLICATION_PACKAGE_MANAGERS[number],
  runner: CommandRunner,
  platform: string,
  signal?: AbortSignal,
): Promise<PackageManagerCapability> {
  if (platform !== 'win32') {
    return {
      id: manager.id,
      label: manager.label,
      status: 'unsupported',
      reason: 'Application package detection is supported on Windows only.',
    };
  }

  try {
    const result = await runner(manager.executable, manager.versionArgs, {
      signal,
      timeoutMs: CAPABILITY_TIMEOUT_MS,
      maxBufferBytes: CAPABILITY_MAX_BUFFER_BYTES,
    });
    const version = cleanVersion(cleanOutput(result.stdout).split(/\r?\n/, 1)[0]);
    if (!version) {
      return {
        id: manager.id,
        label: manager.label,
        status: 'error',
        reason: `${manager.label} did not return a valid version.`,
      };
    }
    return { id: manager.id, label: manager.label, status: 'available', version };
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (isExecutableMissing(error)) {
      return {
        id: manager.id,
        label: manager.label,
        status: 'unavailable',
        reason: `${manager.label} is not installed or is not available to this app.`,
      };
    }
    return {
      id: manager.id,
      label: manager.label,
      status: 'error',
      reason: `${manager.label} could not complete its capability check.`,
    };
  }
}

function findWingetVersion(stdout: string, packageId: string): string | undefined | null {
  for (const line of cleanOutput(stdout).split(/\r?\n/)) {
    const tokens = line.trim().split(/\s+/);
    const idIndex = tokens.findIndex((token) => token.toLocaleLowerCase('en-US') === packageId.toLocaleLowerCase('en-US'));
    if (idIndex >= 0) return cleanVersion(tokens[idIndex + 1]);
  }
  return null;
}

function findChocolateyVersion(stdout: string, packageId: string): string | undefined | null {
  for (const line of cleanOutput(stdout).split(/\r?\n/)) {
    const [candidateId, candidateVersion] = line.trim().split('|', 2);
    if (candidateId?.toLocaleLowerCase('en-US') === packageId.toLocaleLowerCase('en-US')) {
      return cleanVersion(candidateVersion);
    }
  }
  return null;
}

async function queryWinget(
  encodedPackageId: string,
  runner: CommandRunner,
  signal?: AbortSignal,
): Promise<PackageQueryResult> {
  const storePrefix = 'msstore:';
  const packageId = encodedPackageId.startsWith(storePrefix)
    ? encodedPackageId.slice(storePrefix.length)
    : encodedPackageId;
  const sourceArgs = encodedPackageId.startsWith(storePrefix) ? ['--source', 'msstore'] : [];
  try {
    const result = await runner('winget.exe', [
      'list',
      '--id', packageId,
      '--exact',
      ...sourceArgs,
      '--accept-source-agreements',
      '--disable-interactivity',
    ], { signal, timeoutMs: QUERY_TIMEOUT_MS, maxBufferBytes: QUERY_MAX_BUFFER_BYTES });
    const version = findWingetVersion(result.stdout, packageId);
    return version === null
      ? { state: 'not-installed', manager: 'winget' }
      : { state: 'installed', manager: 'winget', ...(version ? { version } : {}) };
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (isWingetNoApplicationsFound(error)) return { state: 'not-installed', manager: 'winget' };
    return { state: 'error', manager: 'winget' };
  }
}

async function queryManagerPackages(
  manager: PackageManagerId,
  packageIds: readonly string[],
  runner: CommandRunner,
  signal?: AbortSignal,
): Promise<PackageQueryResult | null> {
  if (packageIds.length === 0) return null;
  const results: PackageQueryResult[] = [];
  for (const packageId of packageIds) {
    results.push(manager === 'winget'
      ? await queryWinget(packageId, runner, signal)
      : await queryChocolatey(packageId, runner, signal));
  }
  if (results.every((result) => result.state === 'installed')) {
    const versions = new Set(results.map((result) => result.version).filter(Boolean));
    const version = versions.size === 1 ? [...versions][0] : undefined;
    return { state: 'installed', manager, ...(version ? { version } : {}) };
  }
  if (results.every((result) => result.state === 'not-installed')) {
    return { state: 'not-installed', manager };
  }
  return { state: 'error', manager };
}

async function queryChocolatey(
  packageId: string,
  runner: CommandRunner,
  signal?: AbortSignal,
): Promise<PackageQueryResult> {
  try {
    const result = await runner('choco.exe', [
      'list',
      packageId,
      '--exact',
      '--limit-output',
      '--no-progress',
      '--no-color',
    ], { signal, timeoutMs: QUERY_TIMEOUT_MS, maxBufferBytes: QUERY_MAX_BUFFER_BYTES });
    const version = findChocolateyVersion(result.stdout, packageId);
    return version === null
      ? { state: 'not-installed', manager: 'chocolatey' }
      : { state: 'installed', manager: 'chocolatey', ...(version ? { version } : {}) };
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof Error && Reflect.get(error, 'code') === 2) {
      return { state: 'not-installed', manager: 'chocolatey' };
    }
    return { state: 'error', manager: 'chocolatey' };
  }
}

async function queryApplication(
  entry: ApplicationCatalogItem,
  managers: readonly PackageManagerCapability[],
  runner: CommandRunner,
  signal?: AbortSignal,
): Promise<ApplicationInstalledState> {
  const available = new Set(
    managers.filter((manager) => manager.status === 'available').map((manager) => manager.id),
  );
  const checks: PackageQueryResult[] = [];

  if (available.has('winget') && entry.winget.length > 0) {
    const result = await queryManagerPackages('winget', entry.winget, runner, signal);
    if (result) checks.push(result);
    if (result?.state === 'installed') {
      return { id: entry.key as ApplicationCatalogId, name: entry.name, category: entry.category, status: 'installed', manager: 'winget', ...(result.version ? { version: result.version } : {}) };
    }
  }

  if (available.has('chocolatey') && entry.choco.length > 0) {
    const result = await queryManagerPackages('chocolatey', entry.choco, runner, signal);
    if (result) checks.push(result);
    if (result?.state === 'installed') {
      return { id: entry.key as ApplicationCatalogId, name: entry.name, category: entry.category, status: 'installed', manager: 'chocolatey', ...(result.version ? { version: result.version } : {}) };
    }
  }

  if (checks.length === 0) {
    return {
      id: entry.key as ApplicationCatalogId,
      name: entry.name,
      category: entry.category,
      status: 'unknown',
      manager: null,
      reason: 'No supported package manager is currently available.',
    };
  }
  if (checks.some((result) => result.state === 'error')) {
    return {
      id: entry.key as ApplicationCatalogId,
      name: entry.name,
      category: entry.category,
      status: 'unknown',
      manager: null,
      reason: 'At least one installed-state query could not complete.',
    };
  }
  return { id: entry.key as ApplicationCatalogId, name: entry.name, category: entry.category, status: 'not-installed', manager: null };
}

function resolveCatalogItems(applicationKeys: readonly ApplicationCatalogId[]): ApplicationCatalogItem[] {
  if (applicationKeys.length === 0 || applicationKeys.length > MAX_APPLICATION_CAPABILITY_KEYS) {
    throw new Error(`Application capability scans require 1-${MAX_APPLICATION_CAPABILITY_KEYS} catalog keys.`);
  }
  const byKey = new Map<string, ApplicationCatalogItem>(APPLICATION_CATALOG.map((entry) => [entry.key, entry]));
  const entries: ApplicationCatalogItem[] = [];
  const seen = new Set<string>();
  for (const key of applicationKeys) {
    if (seen.has(key)) continue;
    const entry = byKey.get(key);
    if (!entry) throw new Error('Application capability scan contains an unlisted catalog key.');
    seen.add(key);
    entries.push(entry);
  }
  return entries;
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(values[currentIndex]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function readApplicationCapabilitySnapshot(
  options: ReadApplicationCapabilitiesOptions,
): Promise<ApplicationCapabilitySnapshot> {
  const runner = options.runner ?? defaultCommandRunner;
  const catalogItems = resolveCatalogItems(options.applicationKeys);
  const managers = await Promise.all(
    APPLICATION_PACKAGE_MANAGERS.map((manager) => detectPackageManager(manager, runner, options.platform, options.signal)),
  );
  const applications = await mapWithConcurrency(
    catalogItems,
    QUERY_CONCURRENCY,
    (entry) => queryApplication(entry, managers, runner, options.signal),
  );
  return {
    operationId: options.operationId,
    state: 'completed',
    checkedAt: (options.now ?? (() => new Date()))().toISOString(),
    managers,
    applications,
  };
}

export function createApplicationCapabilityFixture(
  operationId: string,
  applicationKeys: readonly ApplicationCatalogId[],
): ApplicationCapabilitySnapshot {
  const reason = 'Documentation capture fixture does not inspect package managers or installed applications.';
  const catalogItems = resolveCatalogItems(applicationKeys);
  return {
    operationId,
    state: 'completed',
    checkedAt: '2026-08-11T00:00:00.000Z',
    managers: APPLICATION_PACKAGE_MANAGERS.map((manager) => ({
      id: manager.id,
      label: manager.label,
      status: 'unsupported',
      reason,
    })),
    applications: catalogItems.map((entry) => ({
      id: entry.key as ApplicationCatalogId,
      name: entry.name,
      category: entry.category,
      status: 'unknown',
      manager: null,
      reason,
    })),
  };
}
