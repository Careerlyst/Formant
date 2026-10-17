export function classifyRequestFailure(error) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'connection';

  const status = Number(error?.status ?? error?.context?.status ?? error?.response?.status);
  if (status >= 500) return 'service';
  if (status >= 400) return 'request';

  const name = String(error?.name || '');
  const message = String(error?.message || '');
  if (name === 'AbortError' || /failed to fetch|fetch failed|networkerror|network request failed|load failed|connection/i.test(message)) {
    return 'connection';
  }
  return 'unexpected';
}
