// Shared profile readiness model. Optional details are recommendations, not
// required work, so a complete core profile is not penalized for omissions.
export const PROFILE_COMPLETION_FIELDS = ['name', 'target_role', 'career_background'];

export function getProfileProgress(profile = {}) {
  const hasCareerBackground = Boolean(
    String(profile?.experience ?? '').trim() || String(profile?.education ?? '').trim()
  );
  const checks = [
    { key: 'name', label: 'Full name', done: Boolean(String(profile?.name ?? '').trim()) },
    { key: 'target_role', label: 'Target role', done: Boolean(String(profile?.target_role ?? '').trim()) },
    { key: 'career_background', label: 'Experience or education', done: hasCareerBackground }
  ];
  const completed = checks.filter((item) => item.done).length;
  return {
    percent: Math.round((completed / checks.length) * 100),
    checks,
    missing: checks.filter((item) => !item.done).map((item) => item.key)
  };
}

export function getProfileCompletion(profile = {}) {
  return getProfileProgress(profile).percent;
}

export function getMissingProfileFields(profile = {}) {
  return getProfileProgress(profile).missing;
}
