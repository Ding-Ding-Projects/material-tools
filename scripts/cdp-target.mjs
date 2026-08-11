function normalizedUrl(value, label) {
  try {
    return new URL(value).href;
  } catch {
    throw new Error(`${label} must be an absolute URL.`);
  }
}

function isLoopbackHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === 'localhost' || normalized === '::1' || normalized.startsWith('127.');
}

export function selectSoleCdpPage(targets, expectedUrl, expectedPort) {
  if (!Array.isArray(targets)) throw new Error('CDP target discovery returned a non-array payload.');
  if (targets.length !== 1) {
    throw new Error(`CDP isolation failed: expected exactly one target, received ${targets.length}.`);
  }

  const [target] = targets;
  if (!target || target.type !== 'page') {
    throw new Error(`CDP isolation failed: the sole target must be a page, received ${target?.type ?? 'missing'}.`);
  }

  const expected = normalizedUrl(expectedUrl, 'The expected page URL');
  const actual = normalizedUrl(target.url, 'The CDP page URL');
  if (actual !== expected) {
    throw new Error(`CDP isolation failed: expected ${expected}, received ${actual}.`);
  }

  const debuggerUrl = normalizedUrl(target.webSocketDebuggerUrl, 'The CDP WebSocket debugger URL');
  const parsedDebuggerUrl = new URL(debuggerUrl);
  if (parsedDebuggerUrl.protocol !== 'ws:' || !isLoopbackHostname(parsedDebuggerUrl.hostname)) {
    throw new Error('CDP isolation failed: the WebSocket debugger URL must use ws:// on a loopback host.');
  }
  if (expectedPort !== undefined && parsedDebuggerUrl.port !== String(expectedPort)) {
    throw new Error(`CDP isolation failed: expected debugger port ${expectedPort}, received ${parsedDebuggerUrl.port || 'default'}.`);
  }

  return target;
}
