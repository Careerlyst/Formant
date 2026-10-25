import { supabase } from './supabase';
import { getProfileAvatar } from './profileAvatars';

export const PROFILE_SELECT = [
  'id', 'name', 'email', 'phone', 'location', 'target_role', 'experience',
  'education', 'skills', 'certifications', 'linkedin', 'github', 'portfolio',
  'bio', 'preferences', 'avatar_id', 'lead_assessment', 'lead_score', 'lead_status',
  'lead_assessment_completed_at'
].join(', ');

export async function fetchProfile(userId) {
  if (!supabase || !userId) throw new Error('A signed-in user is required to load this profile.');
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function saveProfile(userId, values) {
  if (!supabase || !userId) throw new Error('Your session could not be verified. Please sign in again.');
  const { data, error } = await supabase
    .from('profiles')
    .update(values)
    .eq('id', userId)
    .select(PROFILE_SELECT)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('No profile row was updated. Your changes were not confirmed as saved.');
  return data;
}

export async function saveOwnProfileAvatar(avatarId) {
  const avatar = getProfileAvatar(avatarId);
  if (!avatar) throw new Error('Choose an approved Formant avatar before saving.');
  if (!supabase) throw new Error('Your session could not be verified. Please sign in again.');

  const { data, error } = await supabase.rpc('save_own_profile_avatar_v1', {
    p_avatar_id: avatar.id
  });
  if (error) throw error;
  if (Number(data) !== avatar.id) throw new Error('The avatar update was not confirmed as saved.');
  return { avatar_id: avatar.id };
}
