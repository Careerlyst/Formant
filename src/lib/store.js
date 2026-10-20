const ACTIVE_USER_KEY = 'formant_demo_active_user';
const USER_KEY_PREFIX = 'careerlyst_demo_user_';

const seed = {
  user: null,
  orders: [],
  messages: [],
  files: [],
  notifications: [],
  profile: { name: '', email: '' },
  queue: { active: 2, capacity: 2, waiting: 3 }
};

function normalizeUserKey(identifier) {
  if (!identifier) return null;
  const raw = typeof identifier === 'object'
    ? (identifier.id || identifier.email || '')
    : String(identifier);
  const clean = raw.trim().toLowerCase();
  if (!clean) return null;
  // Encode the complete identity instead of replacing punctuation with `_`.
  // Distinct addresses such as mia+test@example.com and mia_test@example.com
  // must never share a demo storage namespace.
  return Array.from(clean, (character) => character.codePointAt(0).toString(16)).join('-');
}

function getUserStorageKey(userIdentifier) {
  const norm = normalizeUserKey(userIdentifier);
  return norm ? `${USER_KEY_PREFIX}${norm}` : null;
}

let migrated = false;
function migrateLegacyData() {
  if (migrated || typeof localStorage === 'undefined') return;
  migrated = true;
  try {
    const rawLegacy = localStorage.getItem('careerlyst_demo');
    if (!rawLegacy) return;
    const parsed = JSON.parse(rawLegacy);
    if (parsed && typeof parsed === 'object' && parsed.user?.email) {
      const userKey = getUserStorageKey(parsed.user.email);
      if (userKey && !localStorage.getItem(userKey)) {
        localStorage.setItem(userKey, JSON.stringify({ ...seed, ...parsed }));
      }
      if (!localStorage.getItem(ACTIVE_USER_KEY)) {
        localStorage.setItem(ACTIVE_USER_KEY, normalizeUserKey(parsed.user.email));
      }
    }
    localStorage.removeItem('careerlyst_demo');
  } catch (e) {
    try { localStorage.removeItem('careerlyst_demo'); } catch (_) {}
  }
}

export function load() {
  if (typeof localStorage === 'undefined') return { ...seed };
  try {
    migrateLegacyData();
    const activeId = localStorage.getItem(ACTIVE_USER_KEY);
    if (!activeId) {
      return { ...seed };
    }
    // The active key is already normalized; do not encode it a second time.
    const key = `${USER_KEY_PREFIX}${activeId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return { ...seed };
    const parsed = JSON.parse(raw);
    const actualId = normalizeUserKey(parsed?.user || activeId);
    const actualKey = actualId ? `${USER_KEY_PREFIX}${actualId}` : null;
    // Migrate legacy per-user keys after reading their stored identity.
    if (actualKey && actualKey !== key && !localStorage.getItem(actualKey)) {
      localStorage.setItem(actualKey, raw);
      localStorage.setItem(ACTIVE_USER_KEY, actualId);
    }
    return { ...seed, ...parsed };
  } catch {
    return { ...seed };
  }
}

export function loadForUser(userIdentifier) {
  if (typeof localStorage === 'undefined') return { ...seed };
  migrateLegacyData();
  const key = getUserStorageKey(userIdentifier);
  if (!key) return { ...seed };
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    if (!parsed || typeof parsed !== 'object') return { ...seed };
    return { ...seed, ...parsed };
  } catch {
    return { ...seed };
  }
}

// Activate a user-scoped cache without ever merging the previous active
// account's profile, messages, files, or notifications into this identity.
export function activateUser(userIdentifier, identity = {}) {
  const norm = normalizeUserKey(userIdentifier);
  if (!norm || typeof localStorage === 'undefined') return { ...seed };
  const current = loadForUser(userIdentifier);
  const { replaceProfile = false, ...stateIdentity } = identity;
  const next = {
    ...current,
    ...stateIdentity,
    user: { ...(current.user || {}), ...(stateIdentity.user || {}) },
    profile: replaceProfile
      ? { ...(stateIdentity.profile || {}) }
      : { ...(current.profile || {}), ...(stateIdentity.profile || {}) }
  };
  try {
    localStorage.setItem(ACTIVE_USER_KEY, norm);
    localStorage.setItem(`${USER_KEY_PREFIX}${norm}`, JSON.stringify(next));
  } catch (error) {
    console.error('Could not persist the user-scoped cache:', error);
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('careerlyst-store'));
  return next;
}

export function save(data) {
  if (typeof localStorage === 'undefined') return data;
  try {
    const targetUser = data?.user;
    const norm = normalizeUserKey(targetUser);
    if (norm) {
      localStorage.setItem(ACTIVE_USER_KEY, norm);
      const key = `${USER_KEY_PREFIX}${norm}`;
      localStorage.setItem(key, JSON.stringify(data));
    } else {
      localStorage.removeItem(ACTIVE_USER_KEY);
    }
  } catch (err) {
    console.error('store save error:', err);
  }
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new Event('careerlyst-store'));
  }
  return data;
}

export function patch(fn) {
  return save(fn(load()));
}

export function logout() {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(ACTIVE_USER_KEY);
    } catch (_) {}
  }
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new Event('careerlyst-store'));
  }
}

export function demoLogin(email, name = 'Demo Client') {
  const norm = normalizeUserKey(email);
  if (norm && typeof localStorage !== 'undefined') {
    localStorage.setItem(ACTIVE_USER_KEY, norm);
    const existing = load();
    return save({
      ...existing,
      user: { email, name },
      profile: { ...(existing.profile || {}), name, email }
    });
  }
  return patch((s) => ({
    ...s,
    user: { email, name },
    profile: { ...(s.profile || {}), name, email }
  }));
}

export const services = [
  { id: 'resume', name: 'Resume / CV', desc: 'Rework your CV’s structure and wording around a target role.', price: 'From $19' },
  { id: 'linkedin', name: 'LinkedIn', desc: 'Refine your headline, About section and experience for the roles you want.', price: 'From $29' },
  { id: 'github', name: 'GitHub', desc: 'Curate repositories and README content to make your strongest work easier to find.', price: 'From $29' },
  { id: 'portfolio', name: 'Portfolio', desc: 'Plan project pages and case studies that explain your role and decisions.', price: 'From $79' },
  { id: 'cover', name: 'Cover Letter', desc: 'Connect your experience to the requirements of a specific opportunity.', price: 'From $19' },
  { id: 'interview', name: 'Interview Preparation', desc: 'Practice role-specific answers and get feedback before the interview.', price: 'From $49' }
];
