export function isTrustedRendererNavigation(targetUrl: string, rendererUrl: string): boolean {
  return targetUrl === rendererUrl;
}
