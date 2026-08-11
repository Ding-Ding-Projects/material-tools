import { describe, expect, it } from 'vitest';
import { selectSoleCdpPage } from '../../../scripts/cdp-target.mjs';

const expectedUrl = 'https://example.test/docs/';
const validTarget = {
  type: 'page',
  url: expectedUrl,
  webSocketDebuggerUrl: 'ws://127.0.0.1:9338/devtools/page/one',
};

describe('selectSoleCdpPage', () => {
  it('accepts one exact page on the expected loopback debugger port', () => {
    expect(selectSoleCdpPage([validTarget], expectedUrl, 9338)).toEqual(validTarget);
  });

  it.each([
    ['no targets', []],
    ['multiple targets', [validTarget, { ...validTarget, url: 'https://example.test/other/' }]],
  ])('rejects %s', (_label, targets) => {
    expect(() => selectSoleCdpPage(targets, expectedUrl, 9338)).toThrow(/expected exactly one target/);
  });

  it('rejects a non-page target', () => {
    expect(() => selectSoleCdpPage([{ ...validTarget, type: 'service_worker' }], expectedUrl, 9338)).toThrow(/sole target must be a page/);
  });

  it('rejects a page whose normalized URL is not an exact match', () => {
    expect(() => selectSoleCdpPage([{ ...validTarget, url: `${expectedUrl}?unexpected=1` }], expectedUrl, 9338)).toThrow(/expected .* received/);
  });

  it.each([
    'ws://192.0.2.10:9338/devtools/page/one',
    'wss://127.0.0.1:9338/devtools/page/one',
    'not-a-url',
  ])('rejects a non-loopback debugger endpoint: %s', (webSocketDebuggerUrl) => {
    expect(() => selectSoleCdpPage([{ ...validTarget, webSocketDebuggerUrl }], expectedUrl, 9338)).toThrow(/WebSocket debugger URL|absolute URL/);
  });

  it('rejects a debugger endpoint on a different port', () => {
    expect(() => selectSoleCdpPage([validTarget], expectedUrl, 9444)).toThrow(/expected debugger port 9444/);
  });
});
