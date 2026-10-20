import { supabase } from './supabase';

export const PROFILE_SELECT = [
  'id', 'name', 'email', 'phone', 'location', 'target_role', 'experience',
  'education', 'skills', 'certifications', 'linkedin', 'github', 'portfolio',
  'bio', 'preferences', 'lead_assessment', 'lead_score', 'lead_status',
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
