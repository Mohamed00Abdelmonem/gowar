export function normalizeImageUrl(rawUrl?: string | null): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (
      parsed.protocol === 'http:' &&
      (parsed.pathname.startsWith('/media/') || parsed.pathname.startsWith('/static/'))
    ) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // Keep non-URL strings as-is
  }
  return trimmed;
}
