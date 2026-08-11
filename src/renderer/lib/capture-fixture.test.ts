import { describe, expect, it } from 'vitest';
import { createDocumentationCaptureSummary } from '../../shared/capture-fixture';

describe('documentation capture fixture', () => {
  it('contains deterministic, non-device-specific values and identifies itself', () => {
    expect(createDocumentationCaptureSummary('0.1.0')).toEqual(expect.objectContaining({
      hostname: 'Documentation fixture',
      cpuModel: 'Reference x64 processor',
      appVersion: '0.1.0',
      captureFixture: true,
    }));
  });
});
