import type { SystemSummary } from './contracts';

export function createDocumentationCaptureSummary(appVersion: string): SystemSummary {
  return {
    hostname: 'Documentation fixture',
    platform: 'win32',
    release: '10.0.22631',
    architecture: 'x64',
    cpuModel: 'Reference x64 processor',
    logicalProcessors: 8,
    totalMemoryBytes: 16 * 1024 ** 3,
    freeMemoryBytes: 12 * 1024 ** 3,
    uptimeSeconds: 7_200,
    appVersion,
    elevated: false,
    captureFixture: true,
  };
}
