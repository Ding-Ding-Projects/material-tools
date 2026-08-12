import type {
  ApplicationCatalogId,
  ApplicationOperationAction,
  ApplicationOperationPreview,
  ApplicationOperationProgress,
  ApplicationOperationResult,
} from '../../shared/contracts';

export interface ApplicationOperationResultSummary {
  succeeded: number;
  failed: number;
  cancelled: number;
  unavailable: number;
  total: number;
}

export function isApplicationOperationPreviewStale(
  preview: ApplicationOperationPreview | null,
  action: ApplicationOperationAction,
  selectedApplicationIds: readonly ApplicationCatalogId[],
): boolean {
  if (!preview) return false;
  if (preview.action !== action || preview.items.length !== selectedApplicationIds.length) return true;
  return preview.items.some((item, index) => item.applicationId !== selectedApplicationIds[index]);
}

export function upsertApplicationOperationProgress(
  current: readonly ApplicationOperationProgress[],
  next: ApplicationOperationProgress,
): ApplicationOperationProgress[] {
  const index = current.findIndex((item) => item.applicationId === next.applicationId);
  if (index < 0) return [...current, next];
  return current.map((item, itemIndex) => itemIndex === index ? next : item);
}

export function summarizeApplicationOperationResult(
  result: ApplicationOperationResult,
): ApplicationOperationResultSummary {
  return result.items.reduce<ApplicationOperationResultSummary>((summary, item) => ({
    ...summary,
    [item.state]: summary[item.state] + 1,
    total: summary.total + 1,
  }), { succeeded: 0, failed: 0, cancelled: 0, unavailable: 0, total: 0 });
}
