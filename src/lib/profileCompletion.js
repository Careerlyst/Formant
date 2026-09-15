    // Careerlyst — shared profile completion logic
// Keep this list as the single source of truth for profile completion.

export const PROFILE_COMPLETION_FIELDS = [
  'name',
  'phone',
  'target_role',
  'experience',
  'education',
  'linkedin',
  'github',
  'portfolio',
  'bio'
];

export function getProfileCompletion(profile = {}) {
  const total = PROFILE_COMPLETION_FIELDS.length;

  if (!total) return 0;

  const completed = PROFILE_COMPLETION_FIELDS.filter(
    (key) => String(profile?.[key] ?? '').trim().length > 0
  ).length;

  return Math.round((completed / total) * 100);
}

export function getMissingProfileFields(profile = {}) {
  return PROFILE_COMPLETION_FIELDS.filter(
    (key) => !String(profile?.[key] ?? '').trim()
  );
}