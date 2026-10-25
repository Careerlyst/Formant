import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROFILE_AVATARS, PROFILE_AVATAR_AGE_CATEGORIES, PROFILE_AVATAR_CATEGORY_BY_ID, getFallbackProfileAvatar, getProfileAvatar, getProfileAvatarAgeCategory, getProfileAvatarsByAgeCategory, requiresProfileAvatar, savePendingAvatarSelection, getPendingAvatarSelection, clearPendingAvatarSelection } from '../src/lib/profileAvatars.js';
import { getProfileProgress } from '../src/lib/profileCompletion.js';

test('profile avatar catalog includes the 76 curated IDs and production assets', () => {
  assert.equal(PROFILE_AVATARS.length, 76);
  assert.deepEqual(PROFILE_AVATARS.map(({ id }) => id), Array.from({ length: 76 }, (_, index) => index + 1));

  for (const avatar of PROFILE_AVATARS) {
    assert.match(avatar.filename, /^formant-avatar-\d{3}-.+\.png$/);
    assert.match(avatar.src, /^\/assets\/formant-avatars\/formant-avatar-/);
    assert.ok(avatar.alt.startsWith('Illustrated portrait: '));
    assert.ok(existsSync(resolve('public', `.${avatar.src}`)), `${avatar.filename} should be in Vite's public output`);
    const bytes = readFileSync(resolve('public', `.${avatar.src}`));
    const sourceBytes = readFileSync(resolve('formant-avatar-library/avatars', avatar.filename));
    assert.deepEqual(bytes, sourceBytes, `${avatar.filename} should remain byte-identical to the source library`);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.readUInt32BE(16), 256);
    assert.equal(bytes.readUInt32BE(20), 256);
  }
});

test('avatar lookup accepts stable numeric IDs and safely rejects invalid IDs', () => {
  assert.equal(getProfileAvatar(1)?.filename, PROFILE_AVATARS[0].filename);
  assert.equal(getProfileAvatar('76')?.id, 76);
  assert.equal(getProfileAvatar(null), null);
  assert.equal(getProfileAvatar('invalid'), null);
  assert.equal(getProfileAvatar(77), null);
  assert.equal(getFallbackProfileAvatar()?.id, 1);
  assert.equal(requiresProfileAvatar(null), true);
  assert.equal(requiresProfileAvatar('invalid'), true);
  assert.equal(requiresProfileAvatar(1), false);
  assert.equal(requiresProfileAvatar(null, true), false);
});

test('eight adult appearance categories have the required order and explicit ID membership', () => {
  assert.deepEqual(PROFILE_AVATAR_AGE_CATEGORIES.map(({ label }) => label), [
    'All Avatars', 'Young Adults', 'Early Career', 'Young Professionals', 'Mid-Career',
    'Experienced Professionals', 'Established Professionals', 'Mature Adults', 'Senior Adults'
  ]);

  const expectedIds = {
    'young-adults': [21, 22, 27, 31, 36, 37, 40, 41, 43, 44, 46, 48, 56, 57, 58, 60, 61, 62, 73],
    'early-career': [10, 17, 23, 24, 26, 28, 29, 30, 35, 42, 45, 47, 59, 66, 74],
    'young-professionals': [33, 38, 50, 51, 54, 63, 64, 65, 70],
    'mid-career': [8, 11, 12, 14, 15, 18, 25, 32, 39, 52, 55, 68, 69, 71, 75, 76],
    'experienced-professionals': [4, 5, 7, 49, 67],
    'established-professionals': [6, 53],
    'mature-adults': [1, 2, 3, 9, 13, 16, 72],
    'senior-adults': [19, 20, 34]
  };

  assert.deepEqual(getProfileAvatarsByAgeCategory('all'), PROFILE_AVATARS);
  assert.deepEqual(getProfileAvatarsByAgeCategory('unknown'), []);
  for (const [category, ids] of Object.entries(expectedIds)) {
    assert.deepEqual(getProfileAvatarsByAgeCategory(category).map(({ id }) => id), ids, `${category} membership`);
  }

  const categorizedIds = Object.values(expectedIds).flat().sort((a, b) => a - b);
  assert.deepEqual(categorizedIds, PROFILE_AVATARS.map(({ id }) => id).sort((a, b) => a - b));
  assert.deepEqual(Object.keys(PROFILE_AVATAR_CATEGORY_BY_ID).map(Number).sort((a, b) => a - b), PROFILE_AVATARS.map(({ id }) => id));
  assert.equal(getProfileAvatarAgeCategory({ id: 1 }), 'mature-adults');
  assert.equal(getProfileAvatarAgeCategory({ id: 76 }), 'mid-career');
  assert.equal(getProfileAvatarAgeCategory({ id: 77 }), null);

  const selectedAvatarId = 21;
  for (const category of Object.keys(expectedIds)) {
    getProfileAvatarsByAgeCategory(category);
    assert.equal(getProfileAvatar(selectedAvatarId)?.id, selectedAvatarId, 'filtering must not change the selected avatar');
  }
  assert.equal(getProfileAvatarsByAgeCategory('early-career').some(({ id }) => id === selectedAvatarId), false);
  assert.equal(getProfileAvatarsByAgeCategory('young-adults').find(({ id }) => id === selectedAvatarId)?.id, selectedAvatarId);
  assert.deepEqual(PROFILE_AVATARS.map(({ id }) => id), Array.from({ length: 76 }, (_, index) => index + 1));
});

test('avatar migration repairs every profile before enforcing the ID constraint', () => {
  const migration = readFileSync(resolve('supabase/migrations/20261025120000_profile_avatar_selection.sql'), 'utf8');
  const updateIndex = migration.indexOf('update public.profiles p');
  const constraintIndex = migration.indexOf('add constraint profiles_avatar_id_library_range');
  assert.ok(updateIndex > -1 && constraintIndex > updateIndex);
  assert.match(migration, /add column if not exists avatar_id smallint/);
  assert.match(migration, /check \(avatar_id is null or avatar_id between 1 and 76\)/);
  assert.match(migration, /row_number\(\) over \(order by p\.id::text\)/);
  assert.match(migration, /where p\.avatar_id is null or p\.avatar_id not between 1 and 76/);
  assert.doesNotMatch(migration, /user_roles|role_row|ranked_clients/);
  assert.match(migration, /revoke update on table public\.profiles from public, anon, authenticated/);
  assert.match(migration, /revoke update \(avatar_id\).*public, anon, authenticated/s);
  assert.match(migration, /create or replace function public\.save_own_profile_avatar_v1/);
  assert.match(migration, /where id = v_user_id/);
  assert.match(migration, /grant execute on function public\.save_own_profile_avatar_v1\(smallint\) to authenticated/);
  assert.doesNotMatch(migration, /grant update \(avatar_id\)/);
});

test('avatar is a required profile completion field and pending signup choice is email-scoped', () => {
  assert.equal(getProfileProgress({ name: 'Client', target_role: 'Designer', experience: '5 years' }).percent, 75);
  assert.deepEqual(getProfileProgress({ avatar_id: 12, name: 'Client', target_role: 'Designer', experience: '5 years' }).missing, []);

  const originalStorage = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
  try {
    assert.equal(savePendingAvatarSelection('Client@Example.com', 12), true);
    assert.equal(getPendingAvatarSelection('client@example.com')?.avatarId, 12);
    assert.equal(getPendingAvatarSelection('someone-else@example.com'), null);
    clearPendingAvatarSelection();
    assert.equal(getPendingAvatarSelection('client@example.com'), null);
  } finally {
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});
