export const ADMIN_HOSTNAME = 'admin.formant.cv';

export function isAdminHostname(hostname) {
  return String(hostname || '').toLowerCase() === ADMIN_HOSTNAME;
}

export function getHostRouteDestination(hostname, currentPath = '/') {
  const path = currentPath || '/';
  const isClientDashboardPath = path === '/dashboard' || path.startsWith('/dashboard/');
  const isClientWorkflowPath = ['/assessment', '/service-selection', '/onboarding/avatar'].includes(path);

  if (isAdminHostname(hostname) && (isClientDashboardPath || isClientWorkflowPath)) {
    return '/';
  }

  return path;
}
