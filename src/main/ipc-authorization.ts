import { isTrustedRendererNavigation } from '../shared/navigation';
import { APPLICATION_CATALOG } from '../shared/application-catalog.generated';
import {
  MAX_APPLICATION_CAPABILITY_KEYS,
  MAX_APPLICATION_OPERATION_KEYS,
  type ApplicationOperationAction,
  type ApplicationCatalogId,
} from '../shared/contracts';

const OPERATION_ID_PATTERN = /^app-capabilities-[0-9]{1,16}-[0-9]{1,10}$/;
const APPLICATION_OPERATION_ID_PATTERN = /^app-operation-[0-9]{1,16}-[0-9]{1,10}$/;
const PLAN_TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const applicationCatalogKeys = new Set<string>(APPLICATION_CATALOG.map((item) => item.key));

export interface IpcSenderIdentity {
  expectedWebContentsId: number | null;
  senderWebContentsId: number;
  senderFrameUrl: string;
  rendererUrl: string;
}

export function isAuthorizedIpcSender(identity: IpcSenderIdentity): boolean {
  return identity.expectedWebContentsId !== null
    && identity.senderWebContentsId === identity.expectedWebContentsId
    && isTrustedRendererNavigation(identity.senderFrameUrl, identity.rendererUrl);
}

export function isValidAppCapabilityOperationId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= 64
    && OPERATION_ID_PATTERN.test(value);
}

export function readAppCapabilityCancelOperationId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const operationId = Reflect.get(value, 'operationId');
  return isValidAppCapabilityOperationId(operationId) ? operationId : null;
}

export function normalizeApplicationCapabilityKeys(value: unknown): ApplicationCatalogId[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_APPLICATION_CAPABILITY_KEYS) return null;
  const keys: ApplicationCatalogId[] = [];
  const seen = new Set<string>();
  for (const key of value) {
    if (typeof key !== 'string' || !applicationCatalogKeys.has(key)) return null;
    if (seen.has(key)) continue;
    seen.add(key);
    keys.push(key as ApplicationCatalogId);
  }
  return keys;
}

export function normalizeApplicationOperationKeys(value: unknown): ApplicationCatalogId[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_APPLICATION_OPERATION_KEYS) return null;
  const keys: ApplicationCatalogId[] = [];
  const seen = new Set<string>();
  for (const key of value) {
    if (typeof key !== 'string' || !applicationCatalogKeys.has(key)) return null;
    if (seen.has(key)) continue;
    seen.add(key);
    keys.push(key as ApplicationCatalogId);
  }
  return keys;
}

export function isValidApplicationOperationId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= 64
    && APPLICATION_OPERATION_ID_PATTERN.test(value);
}

export function isValidApplicationOperationAction(value: unknown): value is ApplicationOperationAction {
  return value === 'install' || value === 'upgrade';
}

export function isValidApplicationPlanToken(value: unknown): value is string {
  return typeof value === 'string' && PLAN_TOKEN_PATTERN.test(value);
}

export interface ApplicationLifecycleState {
  activeCapabilityQueryCount: number;
  applicationOperationPreviewActive: boolean;
  applicationOperationExecutionActive: boolean;
  applicationOperationPendingPlanActive: boolean;
}

export function canStartApplicationCapabilityScan(state: ApplicationLifecycleState): boolean {
  return state.activeCapabilityQueryCount === 0
    && !state.applicationOperationPreviewActive
    && !state.applicationOperationExecutionActive
    && !state.applicationOperationPendingPlanActive;
}

export function canStartApplicationOperationPreview(state: ApplicationLifecycleState): boolean {
  return state.activeCapabilityQueryCount === 0
    && !state.applicationOperationPreviewActive
    && !state.applicationOperationExecutionActive;
}

export function canStartApplicationOperationExecution(state: ApplicationLifecycleState): boolean {
  return state.activeCapabilityQueryCount === 0
    && !state.applicationOperationPreviewActive
    && !state.applicationOperationExecutionActive
    && state.applicationOperationPendingPlanActive;
}
