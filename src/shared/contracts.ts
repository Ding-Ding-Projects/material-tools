import type { APPLICATION_CATALOG } from './application-catalog.generated';

export const IPC_CHANNELS = {
  getSystemSummary: 'system:get-summary',
  getAppCapabilities: 'applications:get-capabilities',
  cancelAppCapabilities: 'applications:cancel-capabilities',
  previewApplicationOperation: 'applications:preview-operation',
  executeApplicationOperation: 'applications:execute-operation',
  cancelApplicationOperation: 'applications:cancel-operation',
  applicationOperationProgress: 'applications:operation-progress',
  minimizeWindow: 'window:minimize',
  toggleMaximizeWindow: 'window:toggle-maximize',
  closeWindow: 'window:close',
} as const;

export type ApplicationCatalogId = typeof APPLICATION_CATALOG[number]['key'];
export const DEFAULT_APPLICATION_CAPABILITY_KEYS = [
  '7zip',
  'firefox',
  'git',
  'notepadplus',
  'powertoys',
  'vlc',
  'vscode',
] as const satisfies readonly ApplicationCatalogId[];
export const MAX_APPLICATION_CAPABILITY_KEYS = 64;
export const MAX_APPLICATION_OPERATION_KEYS = 25;
export type PackageManagerId = 'winget' | 'chocolatey';
export type PackageManagerStatus = 'available' | 'unavailable' | 'unsupported' | 'error';
export type ApplicationInstalledStatus = 'installed' | 'not-installed' | 'unknown';

export interface PackageManagerCapability {
  id: PackageManagerId;
  label: string;
  status: PackageManagerStatus;
  version?: string;
  reason?: string;
}

export interface ApplicationInstalledState {
  id: ApplicationCatalogId;
  name: string;
  category: string;
  status: ApplicationInstalledStatus;
  manager: PackageManagerId | null;
  version?: string;
  reason?: string;
}

export interface ApplicationCapabilitySnapshot {
  operationId: string;
  state: 'completed' | 'cancelled';
  checkedAt: string;
  managers: PackageManagerCapability[];
  applications: ApplicationInstalledState[];
}

export interface ApplicationCapabilityRequest {
  operationId: string;
  applicationKeys: readonly ApplicationCatalogId[];
}

export type ApplicationOperationAction = 'install' | 'upgrade';
export type ApplicationOperationItemState =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'unavailable';

export interface ApplicationOperationPreviewRequest {
  operationId: string;
  action: ApplicationOperationAction;
  applicationKeys: readonly ApplicationCatalogId[];
}

export interface ApplicationOperationExecuteRequest {
  operationId: string;
  planToken: string;
}

export interface ApplicationOperationCancelRequest {
  operationId: string;
}

export interface ApplicationOperationPreviewItem {
  applicationId: ApplicationCatalogId;
  name: string;
  category: string;
  manager: PackageManagerId | null;
  readiness: 'ready' | 'unavailable';
  reason?: string;
}

export interface ApplicationOperationPreview {
  operationId: string;
  planToken: string;
  action: ApplicationOperationAction;
  state: 'ready' | 'unavailable';
  createdAt: string;
  managers: PackageManagerCapability[];
  items: ApplicationOperationPreviewItem[];
}

export interface ApplicationOperationProgress {
  operationId: string;
  applicationId: ApplicationCatalogId;
  name: string;
  action: ApplicationOperationAction;
  manager: PackageManagerId | null;
  state: ApplicationOperationItemState;
  completedCount: number;
  totalCount: number;
  message: string;
}

export interface ApplicationOperationResultItem {
  applicationId: ApplicationCatalogId;
  name: string;
  manager: PackageManagerId | null;
  state: Exclude<ApplicationOperationItemState, 'queued' | 'running'>;
  reason?: string;
}

export interface ApplicationOperationResult {
  operationId: string;
  action: ApplicationOperationAction;
  state: 'completed' | 'partial' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt: string;
  items: ApplicationOperationResultItem[];
}

export interface SystemSummary {
  hostname: string;
  platform: string;
  release: string;
  architecture: string;
  cpuModel: string;
  logicalProcessors: number;
  totalMemoryBytes: number;
  freeMemoryBytes: number;
  uptimeSeconds: number;
  appVersion: string;
  elevated: boolean;
  captureFixture: boolean;
}

export interface MaterialToolsBridge {
  getSystemSummary(): Promise<SystemSummary>;
  getAppCapabilities(applicationKeys?: readonly ApplicationCatalogId[]): Promise<ApplicationCapabilitySnapshot>;
  cancelAppCapabilities(): void;
  previewApplicationOperation(
    action: ApplicationOperationAction,
    applicationKeys: readonly ApplicationCatalogId[],
  ): Promise<ApplicationOperationPreview>;
  executeApplicationOperation(
    operationId: string,
    planToken: string,
  ): Promise<ApplicationOperationResult>;
  cancelApplicationOperation(operationId: string): void;
  onApplicationOperationProgress(
    listener: (progress: ApplicationOperationProgress) => void,
  ): () => void;
  minimizeWindow(): void;
  toggleMaximizeWindow(): void;
  closeWindow(): void;
}
