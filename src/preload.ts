import { contextBridge, ipcRenderer } from 'electron';
import {
  DEFAULT_APPLICATION_CAPABILITY_KEYS,
  IPC_CHANNELS,
  type ApplicationCapabilityRequest,
  type ApplicationCapabilitySnapshot,
  type ApplicationCatalogId,
  type ApplicationOperationAction,
  type ApplicationOperationCancelRequest,
  type ApplicationOperationExecuteRequest,
  type ApplicationOperationPreview,
  type ApplicationOperationPreviewRequest,
  type ApplicationOperationProgress,
  type ApplicationOperationResult,
  type MaterialToolsBridge,
} from './shared/contracts';

let appCapabilitySequence = 0;
let activeAppCapabilityQuery: {
  operationId: string;
  promise: Promise<ApplicationCapabilitySnapshot>;
} | null = null;
let applicationOperationSequence = 0;
let activeApplicationOperation: {
  operationId: string;
  promise: Promise<ApplicationOperationResult>;
} | null = null;

function getAppCapabilities(
  applicationKeys: readonly ApplicationCatalogId[] = DEFAULT_APPLICATION_CAPABILITY_KEYS,
): Promise<ApplicationCapabilitySnapshot> {
  if (activeAppCapabilityQuery) return activeAppCapabilityQuery.promise;
  appCapabilitySequence += 1;
  const operationId = `app-capabilities-${Date.now()}-${appCapabilitySequence}`;
  const request: ApplicationCapabilityRequest = { operationId, applicationKeys: [...applicationKeys] };
  const promise = ipcRenderer
    .invoke(IPC_CHANNELS.getAppCapabilities, request) as Promise<ApplicationCapabilitySnapshot>;
  const trackedPromise = promise.finally(() => {
    if (activeAppCapabilityQuery?.operationId === operationId) activeAppCapabilityQuery = null;
  });
  activeAppCapabilityQuery = { operationId, promise: trackedPromise };
  return trackedPromise;
}

function cancelAppCapabilities(): void {
  if (!activeAppCapabilityQuery) return;
  const request = { operationId: activeAppCapabilityQuery.operationId };
  ipcRenderer.send(IPC_CHANNELS.cancelAppCapabilities, request);
}

function previewApplicationOperation(
  action: ApplicationOperationAction,
  applicationKeys: readonly ApplicationCatalogId[],
): Promise<ApplicationOperationPreview> {
  applicationOperationSequence += 1;
  const operationId = `app-operation-${Date.now()}-${applicationOperationSequence}`;
  const request: ApplicationOperationPreviewRequest = {
    operationId,
    action,
    applicationKeys: [...applicationKeys],
  };
  return ipcRenderer.invoke(
    IPC_CHANNELS.previewApplicationOperation,
    request,
  ) as Promise<ApplicationOperationPreview>;
}

function executeApplicationOperation(
  operationId: string,
  planToken: string,
): Promise<ApplicationOperationResult> {
  if (activeApplicationOperation) return activeApplicationOperation.promise;
  const request: ApplicationOperationExecuteRequest = { operationId, planToken };
  const promise = ipcRenderer.invoke(
    IPC_CHANNELS.executeApplicationOperation,
    request,
  ) as Promise<ApplicationOperationResult>;
  const trackedPromise = promise.finally(() => {
    if (activeApplicationOperation?.operationId === operationId) activeApplicationOperation = null;
  });
  activeApplicationOperation = { operationId, promise: trackedPromise };
  return trackedPromise;
}

function cancelApplicationOperation(operationId: string): void {
  const request: ApplicationOperationCancelRequest = { operationId };
  ipcRenderer.send(IPC_CHANNELS.cancelApplicationOperation, request);
}

function onApplicationOperationProgress(
  listener: (progress: ApplicationOperationProgress) => void,
): () => void {
  const wrapped = (_event: Electron.IpcRendererEvent, progress: ApplicationOperationProgress): void => {
    listener(progress);
  };
  ipcRenderer.on(IPC_CHANNELS.applicationOperationProgress, wrapped);
  return () => ipcRenderer.removeListener(IPC_CHANNELS.applicationOperationProgress, wrapped);
}

const bridge: MaterialToolsBridge = {
  getSystemSummary: () => ipcRenderer.invoke(IPC_CHANNELS.getSystemSummary),
  getAppCapabilities,
  cancelAppCapabilities,
  previewApplicationOperation,
  executeApplicationOperation,
  cancelApplicationOperation,
  onApplicationOperationProgress,
  minimizeWindow: () => ipcRenderer.send(IPC_CHANNELS.minimizeWindow),
  toggleMaximizeWindow: () => ipcRenderer.send(IPC_CHANNELS.toggleMaximizeWindow),
  closeWindow: () => ipcRenderer.send(IPC_CHANNELS.closeWindow),
};

contextBridge.exposeInMainWorld('materialTools', Object.freeze(bridge));
