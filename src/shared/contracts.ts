export const IPC_CHANNELS = {
  getSystemSummary: 'system:get-summary',
  minimizeWindow: 'window:minimize',
  toggleMaximizeWindow: 'window:toggle-maximize',
  closeWindow: 'window:close',
} as const;

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
}

export interface MaterialToolsBridge {
  getSystemSummary(): Promise<SystemSummary>;
  minimizeWindow(): void;
  toggleMaximizeWindow(): void;
  closeWindow(): void;
}
