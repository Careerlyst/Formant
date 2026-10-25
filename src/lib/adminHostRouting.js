export const ADMIN_HOSTNAME = 'admin.formant.cv';

export function getHostRootDestination(hostname, currentPath = '/') {
  if (
    String(hostname || '').toLowerCase() === ADMIN_HOSTNAME &&
    currentPath === '/'
  ) {
    return '/admin';
  }

  return currentPath || '/';
}
