import { createHash, randomBytes } from 'node:crypto';
import {
  APPLICATION_CATALOG,
  type ApplicationCatalogItem,
} from '../shared/application-catalog.generated';
import {
  MAX_APPLICATION_OPERATION_KEYS,
  type ApplicationCatalogId,
  type ApplicationOperationAction,
  type ApplicationOperationPreview,
  type ApplicationOperationProgress,
  type ApplicationOperationResult,
  type ApplicationOperationResultItem,
  type PackageManagerCapability,
  type PackageManagerId,
} from '../shared/contracts';
import {
  APPLICATION_PACKAGE_MANAGERS,
  defaultCommandRunner,
  detectPackageManager,
  readApplicationCapabilitySnapshot,
  readUpgradeInstalledState,
  type CommandRunner,
} from './application-capabilities';

const EXECUTION_TIMEOUT_MS = 5 * 60 * 1_000;
const EXECUTION_MAX_BUFFER_BYTES = 1024 * 1024;
const PLAN_MAX_AGE_MS = 5 * 60 * 1_000;
const FIXTURE_STEP_DELAY_MS = 100;

interface PrivateOperationItem {
  entry: ApplicationCatalogItem;
  manager: PackageManagerId | null;
  packageIds: readonly string[];
  reason?: string;
}

interface PrivateOperationPlan {
  senderId: number;
  operationId: string;
  planToken: string;
  action: ApplicationOperationAction;
  createdAtMs: number;
  managers: PackageManagerCapability[];
  items: PrivateOperationItem[];
}

interface ActiveOperation {
  senderId: number;
  operationId: string;
  controller: AbortController;
}

export interface PreviewApplicationOperationOptions {
  senderId: number;
  operationId: string;
  action: ApplicationOperationAction;
  applicationKeys: readonly ApplicationCatalogId[];
}

export interface ExecuteApplicationOperationOptions {
  senderId: number;
  operationId: string;
  planToken: string;
  onProgress?: (progress: ApplicationOperationProgress) => void;
}

export interface ApplicationOperationCoordinatorOptions {
  platform: string;
  captureFixture?: boolean;
  runner?: CommandRunner;
  now?: () => Date;
  tokenFactory?: (operationId: string, action: ApplicationOperationAction, keys: readonly string[]) => string;
  fixtureStepDelayMs?: number;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error
    && (error.name === 'AbortError' || Reflect.get(error, 'code') === 'ABORT_ERR');
}

function abortError(): Error {
  const error = new Error('The application operation was cancelled.');
  error.name = 'AbortError';
  return error;
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(abortError());
    }, { once: true });
  });
}

function defaultTokenFactory(
  operationId: string,
  action: ApplicationOperationAction,
  keys: readonly string[],
): string {
  return createHash('sha256')
    .update(randomBytes(32))
    .update('\0')
    .update(operationId)
    .update('\0')
    .update(action)
    .update('\0')
    .update(keys.join('\0'))
    .digest('hex');
}

function resolveCatalogItems(applicationKeys: readonly ApplicationCatalogId[]): ApplicationCatalogItem[] {
  if (applicationKeys.length === 0 || applicationKeys.length > MAX_APPLICATION_OPERATION_KEYS) {
    throw new Error(`Application operations require 1-${MAX_APPLICATION_OPERATION_KEYS} catalog keys.`);
  }
  const byKey = new Map<string, ApplicationCatalogItem>(APPLICATION_CATALOG.map((entry) => [entry.key, entry]));
  const items: ApplicationCatalogItem[] = [];
  const seen = new Set<string>();
  for (const key of applicationKeys) {
    if (seen.has(key)) continue;
    const entry = byKey.get(key);
    if (!entry) throw new Error('Application operation contains an unlisted catalog key.');
    seen.add(key);
    items.push(entry);
  }
  return items;
}

function chooseManager(
  entry: ApplicationCatalogItem,
  managers: readonly PackageManagerCapability[],
): PrivateOperationItem {
  if (managers.some((manager) => manager.id === 'winget' && manager.status === 'available')
    && entry.winget.length > 0) {
    return { entry, manager: 'winget', packageIds: [...entry.winget] };
  }
  if (managers.some((manager) => manager.id === 'chocolatey' && manager.status === 'available')
    && entry.choco.length > 0) {
    return { entry, manager: 'chocolatey', packageIds: [...entry.choco] };
  }
  return {
    entry,
    manager: null,
    packageIds: [],
    reason: 'No available package manager supports this catalog item.',
  };
}

function buildCommand(
  action: ApplicationOperationAction,
  manager: PackageManagerId,
  encodedPackageId: string,
): { executable: string; args: string[] } {
  if (manager === 'winget') {
    const storePrefix = 'msstore:';
    const isStorePackage = encodedPackageId.startsWith(storePrefix);
    const packageId = isStorePackage ? encodedPackageId.slice(storePrefix.length) : encodedPackageId;
    return {
      executable: 'winget.exe',
      args: [
        action,
        '--id', packageId,
        '--exact',
        ...(isStorePackage ? ['--source', 'msstore'] : []),
        '--accept-package-agreements',
        '--accept-source-agreements',
        '--disable-interactivity',
      ],
    };
  }
  return {
    executable: 'choco.exe',
    args: [action, encodedPackageId, '--yes', '--no-progress', '--limit-output', '--no-color',
      ...(action === 'upgrade' ? ['--fail-on-not-installed'] : [])],
  };
}

function publicPreview(plan: PrivateOperationPlan): ApplicationOperationPreview {
  const items = plan.items.map(({ entry, manager, reason }) => ({
    applicationId: entry.key as ApplicationCatalogId,
    name: entry.name,
    category: entry.category,
    manager,
    readiness: manager && !reason ? 'ready' as const : 'unavailable' as const,
    ...(reason ? { reason } : {}),
  }));
  return {
    operationId: plan.operationId,
    planToken: plan.planToken,
    action: plan.action,
    state: items.some((item) => item.readiness === 'ready') ? 'ready' : 'unavailable',
    createdAt: new Date(plan.createdAtMs).toISOString(),
    managers: plan.managers,
    items,
  };
}

export class ApplicationOperationCoordinator {
  private readonly platform: string;
  private readonly captureFixture: boolean;
  private readonly runner: CommandRunner;
  private readonly now: () => Date;
  private readonly tokenFactory: NonNullable<ApplicationOperationCoordinatorOptions['tokenFactory']>;
  private readonly fixtureStepDelayMs: number;
  private readonly plans = new Map<string, PrivateOperationPlan>();
  private readonly pendingPlanBySender = new Map<number, string>();
  private readonly operationIds = new Set<string>();
  private active: ActiveOperation | null = null;

  constructor(options: ApplicationOperationCoordinatorOptions) {
    this.platform = options.platform;
    this.captureFixture = options.captureFixture ?? false;
    this.runner = options.runner ?? defaultCommandRunner;
    this.now = options.now ?? (() => new Date());
    this.tokenFactory = options.tokenFactory ?? defaultTokenFactory;
    this.fixtureStepDelayMs = options.fixtureStepDelayMs ?? FIXTURE_STEP_DELAY_MS;
  }

  async preview(options: PreviewApplicationOperationOptions): Promise<ApplicationOperationPreview> {
    if (this.active) throw new Error('Another application operation is already active.');
    if (this.operationIds.has(options.operationId)) {
      throw new Error('Application operation identifier is already in use.');
    }
    const priorToken = this.pendingPlanBySender.get(options.senderId);
    if (priorToken) {
      const priorPlan = this.plans.get(priorToken);
      if (priorPlan) this.operationIds.delete(priorPlan.operationId);
      this.plans.delete(priorToken);
      this.pendingPlanBySender.delete(options.senderId);
    }
    const entries = resolveCatalogItems(options.applicationKeys);
    const managers = this.captureFixture
      ? APPLICATION_PACKAGE_MANAGERS.map((manager, index) => index === 0
        ? { id: manager.id, label: manager.label, status: 'available' as const, version: 'fixture' }
        : { id: manager.id, label: manager.label, status: 'unavailable' as const, reason: 'Capture fixture.' })
      : await Promise.all(APPLICATION_PACKAGE_MANAGERS.map((manager) => (
        detectPackageManager(manager, this.runner, this.platform)
      )));
    const createdAtMs = this.now().getTime();
    const keys = entries.map((entry) => entry.key);
    const planToken = this.tokenFactory(options.operationId, options.action, keys);
    if (!/^[a-f0-9]{64}$/.test(planToken) || this.plans.has(planToken)) {
      throw new Error('Application operation plan token could not be created.');
    }
    const plan: PrivateOperationPlan = {
      senderId: options.senderId,
      operationId: options.operationId,
      planToken,
      action: options.action,
      createdAtMs,
      managers,
      items: entries.map((entry) => chooseManager(entry, managers)),
    };
    if (plan.action === 'upgrade' && !this.captureFixture) {
      for (const item of plan.items) {
        if (!item.manager) continue;
        const installed = await readUpgradeInstalledState(
          item.manager, item.packageIds, this.runner, this.platform, undefined,
          managers.find((manager) => manager.id === item.manager),
        );
        if (installed.state !== 'installed') item.reason = installed.reason;
      }
    }
    this.plans.set(planToken, plan);
    this.pendingPlanBySender.set(options.senderId, planToken);
    this.operationIds.add(options.operationId);
    return publicPreview(plan);
  }

  async execute(options: ExecuteApplicationOperationOptions): Promise<ApplicationOperationResult> {
    if (this.active) throw new Error('Another application operation is already active.');
    const plan = this.plans.get(options.planToken);
    if (!plan
      || plan.operationId !== options.operationId
      || plan.senderId !== options.senderId) {
      throw new Error('Application operation plan was rejected.');
    }
    if (this.now().getTime() - plan.createdAtMs > PLAN_MAX_AGE_MS) {
      this.plans.delete(options.planToken);
      this.pendingPlanBySender.delete(plan.senderId);
      this.operationIds.delete(plan.operationId);
      throw new Error('Application operation plan has expired. Preview it again.');
    }

    // A preview authorizes exactly one execution attempt. Consume it before work starts.
    this.plans.delete(options.planToken);
    this.pendingPlanBySender.delete(plan.senderId);
    const controller = new AbortController();
    this.active = { senderId: plan.senderId, operationId: plan.operationId, controller };
    const startedAt = this.now().toISOString();
    const results: ApplicationOperationResultItem[] = [];
    let completedCount = 0;
    const emit = (
      item: PrivateOperationItem,
      state: ApplicationOperationProgress['state'],
      message: string,
    ): void => {
      const progress: ApplicationOperationProgress = {
        operationId: plan.operationId,
        applicationId: item.entry.key as ApplicationCatalogId,
        name: item.entry.name,
        action: plan.action,
        manager: item.manager,
        state,
        completedCount,
        totalCount: plan.items.length,
        message,
      };
      // Delivery is best-effort: a closing renderer must not change operation
      // outcomes, duplicate terminal results, or interrupt lifecycle cleanup.
      try {
        options.onProgress?.(progress);
      } catch {
        // Do not expose or log notification exceptions or their payloads.
      }
    };

    try {
      for (const item of plan.items) emit(item, 'queued', 'Queued for this application operation.');

      for (const item of plan.items) {
        if (controller.signal.aborted) throw abortError();
        if (!item.manager || item.reason) {
          completedCount += 1;
          const reason = item.reason ?? 'No package manager is available for this item.';
          results.push({
            applicationId: item.entry.key as ApplicationCatalogId,
            name: item.entry.name,
            manager: item.manager,
            state: 'unavailable',
            reason,
          });
          emit(item, 'unavailable', reason);
          continue;
        }

        emit(item, 'running', this.captureFixture
          ? `Simulating ${plan.action} for ${item.entry.name}; no package-manager command will run.`
          : `${plan.action === 'install' ? 'Installing' : 'Upgrading'} ${item.entry.name}.`);
        try {
          if (this.captureFixture) {
            await delay(this.fixtureStepDelayMs, controller.signal);
          } else {
            if (plan.action === 'upgrade') {
              const installed = await readUpgradeInstalledState(
                item.manager, item.packageIds, this.runner, this.platform, controller.signal,
              );
              if (installed.state !== 'installed') {
                completedCount += 1;
                const reason = installed.reason ?? 'Cannot verify upgrade eligibility. Preview again.';
                results.push({
                  applicationId: item.entry.key as ApplicationCatalogId,
                  name: item.entry.name,
                  manager: item.manager,
                  state: 'unavailable',
                  reason,
                });
                emit(item, 'unavailable', reason);
                continue;
              }
            }
            for (const packageId of item.packageIds) {
              if (controller.signal.aborted) throw abortError();
              const command = buildCommand(plan.action, item.manager, packageId);
              await this.runner(command.executable, command.args, {
                signal: controller.signal,
                timeoutMs: EXECUTION_TIMEOUT_MS,
                maxBufferBytes: EXECUTION_MAX_BUFFER_BYTES,
              });
            }
            const installed = plan.action === 'upgrade'
              ? (await readUpgradeInstalledState(
                item.manager, item.packageIds, this.runner, this.platform, controller.signal,
              )).state === 'installed'
              : (await readApplicationCapabilitySnapshot({
                operationId: `${plan.operationId}-verify`,
                applicationKeys: [item.entry.key as ApplicationCatalogId],
                runner: this.runner,
                platform: this.platform,
                signal: controller.signal,
              })).applications[0]?.status === 'installed';
            if (!installed) {
              throw new Error('Package-manager verification did not report the application as installed.');
            }
          }
          completedCount += 1;
          results.push({
            applicationId: item.entry.key as ApplicationCatalogId,
            name: item.entry.name,
            manager: item.manager,
            state: 'succeeded',
            ...(this.captureFixture ? { reason: 'Documentation fixture only; no package-manager command ran.' } : {}),
          });
          emit(item, 'succeeded', this.captureFixture
            ? `${item.entry.name} fixture simulation completed; no package-manager command ran.`
            : `${item.entry.name} completed successfully.`);
        } catch (error) {
          if (isAbortError(error) || controller.signal.aborted) throw abortError();
          completedCount += 1;
          const reason = `${item.entry.name} did not complete. Review the package-manager output locally.`;
          results.push({
            applicationId: item.entry.key as ApplicationCatalogId,
            name: item.entry.name,
            manager: item.manager,
            state: 'failed',
            reason,
          });
          emit(item, 'failed', reason);
        }
      }
    } catch (error) {
      if (!isAbortError(error)) throw error;
      const finishedIds = new Set(results.map((result) => result.applicationId));
      for (const item of plan.items) {
        const applicationId = item.entry.key as ApplicationCatalogId;
        if (finishedIds.has(applicationId)) continue;
        completedCount += 1;
        results.push({
          applicationId,
          name: item.entry.name,
          manager: item.manager,
          state: 'cancelled',
          reason: 'The application operation was cancelled.',
        });
        emit(item, 'cancelled', 'The application operation was cancelled.');
      }
      return {
        operationId: plan.operationId,
        action: plan.action,
        state: 'cancelled',
        startedAt,
        completedAt: this.now().toISOString(),
        items: results,
      };
    } finally {
      this.active = null;
      this.operationIds.delete(plan.operationId);
    }

    const succeeded = results.filter((result) => result.state === 'succeeded').length;
    const state = succeeded === results.length
      ? 'completed'
      : succeeded > 0
        ? 'partial'
        : 'failed';
    return {
      operationId: plan.operationId,
      action: plan.action,
      state,
      startedAt,
      completedAt: this.now().toISOString(),
      items: results,
    };
  }

  cancel(senderId: number, operationId: string): boolean {
    if (this.active
      && this.active.senderId === senderId
      && this.active.operationId === operationId) {
      this.active.controller.abort();
      return true;
    }
    const pendingToken = this.pendingPlanBySender.get(senderId);
    if (!pendingToken) return false;
    const pendingPlan = this.plans.get(pendingToken);
    if (!pendingPlan || pendingPlan.operationId !== operationId) return false;
    this.plans.delete(pendingToken);
    this.pendingPlanBySender.delete(senderId);
    this.operationIds.delete(operationId);
    return true;
  }

  hasLifecycle(): boolean {
    return this.active !== null || this.plans.size > 0;
  }

  hasActiveExecution(): boolean {
    return this.active !== null;
  }

  hasPendingPlan(): boolean {
    return this.plans.size > 0;
  }

  pendingPlanCount(): number {
    return this.plans.size;
  }

  abortAll(): void {
    this.active?.controller.abort();
    this.active = null;
    this.plans.clear();
    this.pendingPlanBySender.clear();
    this.operationIds.clear();
  }
}
