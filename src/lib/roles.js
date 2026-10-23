export const STAFF_ROLES = ['admin', 'expert', 'support', 'finance'];

/**
 * Validates whether a given role string belongs to recognized staff roles.
 * @param {string|null|undefined} role
 * @returns {boolean}
 */
export function isStaffRole(role) {
  return STAFF_ROLES.includes(String(role || '').toLowerCase().trim());
}
