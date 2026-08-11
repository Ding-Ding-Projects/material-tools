import type { MaterialToolsBridge } from '../shared/contracts';

declare global {
  interface Window {
    materialTools: MaterialToolsBridge;
  }
}

export {};
